import "./load-env.mjs";
import cors from "cors";
import express from "express";
import { startGrpcServer } from "./grpc-server.mjs";
import { mkdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { ensurePreviewSession, getPreviewSession, touchPreviewSession } from "./preview-manager.mjs";
import { isR2Configured, publishPreviewSiteToR2, publishRenderArtifactToR2 } from "./r2-client.mjs";
import {
  buildPreviewSite,
  cleanupExpiredLocalArtifacts,
  getCachedPreviewPublishResult,
  getCachedRenderPublishResult,
  renderArtifact,
  startArtifactCleanupScheduler,
  updateCachedPreviewPublishResult,
  updateCachedRenderPublishResult,
} from "./render-manager.mjs";

const PORT = Number(process.env.PORT || 3210);
const PUBLIC_BASE_URL = process.env.MARKOS_PUBLIC_BASE_URL?.replace(/\/$/, "") || null;
const PREVIEW_SITE_BASE_URL = process.env.MARKOS_PREVIEW_SITE_BASE_URL?.replace(/\/$/, "") || null;
const BODY_LIMIT = process.env.MARKOS_BODY_LIMIT || "20mb";
const ARTIFACT_ROOT = join(process.cwd(), ".markos-artifacts");
const RENDER_ARTIFACT_ROOT = join(ARTIFACT_ROOT, "renders");

const previewSessionRequestSchema = z.object({
  projectId: z.string().trim().nullable().optional(),
  cacheKey: z.string().trim().nullable().optional(),
  documentId: z.string().trim().nullable().optional(),
  title: z.string().trim().nullable().optional(),
  content: z.string(),
});

const assetFileSchema = z.object({
  path: z.string().min(1),
  contentBase64: z.string().min(1),
});

const sourceFileSchema = z.object({
  path: z.string().trim().min(1),
  content: z.string().optional(),
  contentBase64: z.string().min(1).optional(),
}).refine((value) => typeof value.content === "string" || typeof value.contentBase64 === "string", {
  message: "Each source file must include content or contentBase64.",
});

const renderJobRequestSchema = z.object({
  title: z.string().trim().nullable().optional(),
  content: z.string().optional(),
  entry: z.string().trim().optional(),
  source: z.object({
    files: z.array(sourceFileSchema).min(1),
  }).optional(),
  format: z.enum(["web", "pdf", "pptx"]),
  fileName: z.string().trim().nullable().optional(),
  publish: z.boolean().optional(),
  assets: z.array(assetFileSchema).optional(),
}).superRefine((value, ctx) => {
  if (!value.source && typeof value.content !== "string") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Render requires either source.files or content.",
      path: ["source"],
    });
  }

  if (value.format !== "web") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Only web format is currently supported.",
      path: ["format"],
    });
  }
});

const previewBuildRequestSchema = z.object({
  previewId: z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/),
  basePath: z.string().trim().optional(),
  entry: z.string().trim().optional(),
  publish: z.boolean().optional(),
  title: z.string().trim().nullable().optional(),
  content: z.string().optional(),
  assets: z.array(assetFileSchema).optional(),
  source: z.object({
    files: z.array(sourceFileSchema).min(1),
  }).optional(),
}).superRefine((value, ctx) => {
  if (!value.source && typeof value.content !== "string") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Preview build requires either source.files or content.",
      path: ["source"],
    });
  }

  if (value.basePath) {
    const normalizedBasePath = `/${value.basePath.replace(/^\/+|\/+$/g, "")}/`;
    const expectedBasePath = `/p/${value.previewId}/`;
    if (normalizedBasePath !== expectedBasePath) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `basePath must match ${expectedBasePath}`,
        path: ["basePath"],
      });
    }
  }
});

export const app = express();
app.set("trust proxy", true);
app.use(cors({ origin: true }));
app.use(express.json({ limit: BODY_LIMIT }));

function getOrigin(req) {
  if (PUBLIC_BASE_URL) return PUBLIC_BASE_URL;
  return `${req.protocol}://${req.get("host")}`;
}

function absolutize(req, path) {
  return new URL(path, `${getOrigin(req)}/`).toString();
}

function getPublishedPreviewUrl(previewId) {
  if (!PREVIEW_SITE_BASE_URL) {
    return null;
  }
  return new URL(`/p/${encodeURIComponent(previewId)}/`, `${PREVIEW_SITE_BASE_URL}/`).toString();
}

async function isFile(filePath) {
  try {
    const fileStat = await stat(filePath);
    return fileStat.isFile();
  } catch {
    return false;
  }
}

function sanitizePreviewObjectPath(objectPath) {
  const normalizedPath = objectPath
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/^(\.\.\/)+/, "");

  if (!normalizedPath || normalizedPath.startsWith("..")) {
    return null;
  }

  return normalizedPath;
}

async function sendPreviewFile(res, previewRoot, relativePath) {
  await new Promise((resolve, reject) => {
    res.sendFile(relativePath, { root: previewRoot }, (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

app.get("/healthz", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/preview/session", async (req, res) => {
  try {
    const payload = previewSessionRequestSchema.parse(req.body);
    const session = await ensurePreviewSession(payload);
    res.json({
      sessionId: session.sessionId,
      baseUrl: absolutize(req, session.slidesPath),
      overviewUrl: absolutize(req, session.overviewPath),
      slidesUrl: absolutize(req, session.slidesPath),
      presenterUrl: absolutize(req, session.presenterPath),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Invalid preview request.", details: error.flatten() });
      return;
    }
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to start preview." });
  }
});

app.post("/api/render", async (req, res) => {
  try {
    const requestStartedAt = Date.now();
    const payload = renderJobRequestSchema.parse(req.body);
    const artifact = await renderArtifact(payload);
    let publishResult = null;
    let publishCacheHit = false;

    if (payload.publish) {
      if (artifact.cacheHit === true) {
        publishResult = await getCachedRenderPublishResult({
          cacheKey: artifact.cacheKey,
          jobId: artifact.jobId,
        });
        publishCacheHit = publishResult != null;
      }

      if (!publishResult) {
        publishResult = await publishRenderArtifactToR2({
          renderId: artifact.jobId,
          format: artifact.format,
          fileName: artifact.fileName,
          artifactFilePath: artifact.artifactFilePath,
          outputDir: artifact.outputDir,
        });
        await updateCachedRenderPublishResult({
          cacheKey: artifact.cacheKey,
          jobId: artifact.jobId,
          publishResult,
        });
      }
    }

    res.json({
      jobId: artifact.jobId,
      format: artifact.format,
      fileName: artifact.fileName,
      artifactUrl: absolutize(req, artifact.artifactPath),
      siteUrl: artifact.format === "web" ? absolutize(req, artifact.artifactPath) : null,
      cacheHit: artifact.cacheHit === true,
      publishCacheHit,
      publishedArtifactUrl: publishResult?.publishedArtifactUrl ?? null,
      r2Configured: isR2Configured(),
      timings: {
        totalMs: Date.now() - requestStartedAt,
      },
      publishResult,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Invalid render request.", details: error.flatten() });
      return;
    }
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to render presentation." });
  }
});

app.post("/api/previews/build", async (req, res) => {
  try {
    const requestStartedAt = Date.now();
    const payload = previewBuildRequestSchema.parse(req.body);
    const buildStartedAt = Date.now();
    const preview = await buildPreviewSite(payload);
    const buildDurationMs = Date.now() - buildStartedAt;
    let publishResult = null;
    let publishCacheHit = false;
    let publishDurationMs = null;

    if (payload.publish) {
      const publishStartedAt = Date.now();
      if (preview.cacheHit === true) {
        publishResult = await getCachedPreviewPublishResult({
          previewId: preview.previewId,
          buildId: preview.buildId,
        });
        publishCacheHit = publishResult != null;
      }

      if (!publishResult) {
        publishResult = await publishPreviewSiteToR2({
          previewId: preview.previewId,
          outputDir: preview.outputDir,
        });
        await updateCachedPreviewPublishResult({
          previewId: preview.previewId,
          buildId: preview.buildId,
          publishResult,
        });
      }
      publishDurationMs = Date.now() - publishStartedAt;
    }

    const localPreviewUrl = absolutize(req, preview.previewPath);
    const publishedPreviewUrl = payload.publish ? getPublishedPreviewUrl(preview.previewId) : null;
    const totalDurationMs = Date.now() - requestStartedAt;

    res.json({
      previewId: preview.previewId,
      buildId: preview.buildId,
      basePath: preview.basePath,
      sourceHash: preview.sourceHash ?? null,
      cacheHit: preview.cacheHit === true,
      publishCacheHit,
      previewUrl: localPreviewUrl,
      localPreviewUrl,
      publishedPreviewUrl,
      manifest: preview.manifest,
      outputDir: preview.outputDir,
      manifestFilePath: preview.manifestFilePath,
      r2Configured: isR2Configured(),
      timings: {
        totalMs: totalDurationMs,
        buildMs: buildDurationMs,
        publishMs: publishDurationMs,
      },
      publishResult,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Invalid preview build request.", details: error.flatten() });
      return;
    }
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to build preview site." });
  }
});

app.use("/preview/:sessionId", async (req, res) => {
  const session = getPreviewSession(req.params.sessionId);
  if (!session?.ready || !session.outputDir) {
    res.status(404).json({ error: "Preview session not found." });
    return;
  }

  touchPreviewSession(session.id);

  try {
    await serveManifestSite({
      req,
      res,
      rootDir: session.outputDir,
      basePrefix: `/preview/${session.id}/`,
      notFoundMessage: "Preview session not found.",
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to serve preview." });
  }
});

app.use("/p/:previewId", async (req, res) => {
  try {
    const previewId = req.params.previewId;
    await serveManifestSite({
      req,
      res,
      rootDir: join(ARTIFACT_ROOT, "previews", previewId),
      basePrefix: `/p/${previewId}/`,
      notFoundMessage: "Preview site not found.",
    });
  } catch (error) {
    if (!res.headersSent) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to serve preview site." });
    }
    return;
  }
});

app.use("/artifacts", express.static(RENDER_ARTIFACT_ROOT, { index: ["index.html"] }));

export async function startServer() {
  await mkdir(ARTIFACT_ROOT, { recursive: true });
  await mkdir(RENDER_ARTIFACT_ROOT, { recursive: true });
  await cleanupExpiredLocalArtifacts();
  startArtifactCleanupScheduler();
  await startGrpcServer();
  return app.listen(PORT, () => {
    console.log(`[markos-renderer] listening on :${PORT}`);
  });
}

async function serveManifestSite({ req, res, rootDir, basePrefix, notFoundMessage }) {
  const pathname = decodeURIComponent(new URL(req.originalUrl, `${getOrigin(req)}/`).pathname);

  if (pathname === basePrefix.slice(0, -1)) {
    res.redirect(301, `${getOrigin(req)}${basePrefix}`);
    return;
  }

  const subPath = pathname.startsWith(basePrefix) ? pathname.slice(basePrefix.length) : "";
  const manifestFilePath = join(rootDir, "manifest.json");

  let manifest;
  try {
    manifest = JSON.parse(await readFile(manifestFilePath, "utf8"));
  } catch {
    res.status(404).json({ error: notFoundMessage });
    return;
  }

  const entry = typeof manifest.entry === "string" && manifest.entry ? manifest.entry : "index.html";
  const spaFallback = manifest.spaFallback === true;
  const assetPrefixes = Array.isArray(manifest.assetPrefixes) ? manifest.assetPrefixes : [];
  const privateFiles = Array.isArray(manifest.privateFiles) ? manifest.privateFiles : [];
  const objectPath = subPath || entry;

  if (privateFiles.includes(objectPath)) {
    res.status(403).send("Forbidden");
    return;
  }

  const safeObjectPath = sanitizePreviewObjectPath(objectPath);
  if (!safeObjectPath) {
    res.status(400).send("Invalid path");
    return;
  }

  const objectFilePath = join(rootDir, safeObjectPath);
  if (await isFile(objectFilePath)) {
    await sendPreviewFile(res, rootDir, safeObjectPath);
    return;
  }

  const isAssetPath = assetPrefixes.some((prefix) => objectPath.startsWith(prefix));
  if (isAssetPath) {
    res.status(404).send("Asset Not Found");
    return;
  }

  if (!spaFallback) {
    res.status(404).send("Not Found");
    return;
  }

  const fallbackRelativePath = sanitizePreviewObjectPath(entry);
  if (!fallbackRelativePath) {
    res.status(500).send("Invalid entry file");
    return;
  }

  const fallbackFilePath = join(rootDir, fallbackRelativePath);
  if (!await isFile(fallbackFilePath)) {
    res.status(404).send("Entry file not found");
    return;
  }

  res.type("html");
  await sendPreviewFile(res, rootDir, fallbackRelativePath);
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] === currentFile) {
  await startServer();
}
