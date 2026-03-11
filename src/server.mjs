import cors from "cors";
import express from "express";
import { mkdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { ensurePreviewSession, getPreviewSession, touchPreviewSession } from "./preview-manager.mjs";
import { buildPreviewSite, renderArtifact } from "./render-manager.mjs";

const PORT = Number(process.env.PORT || 3210);
const PUBLIC_BASE_URL = process.env.SLIDEV_PUBLIC_BASE_URL?.replace(/\/$/, "") || null;
const BODY_LIMIT = process.env.SLIDEV_BODY_LIMIT || "20mb";
const ARTIFACT_ROOT = join(process.cwd(), ".slidev-artifacts");

const previewSessionRequestSchema = z.object({
  projectId: z.string().trim().nullable().optional(),
  cacheKey: z.string().trim().nullable().optional(),
  documentId: z.string().trim().nullable().optional(),
  title: z.string().trim().nullable().optional(),
  content: z.string(),
});

const renderJobRequestSchema = z.object({
  title: z.string().trim().nullable().optional(),
  content: z.string(),
  format: z.enum(["web", "pdf", "pptx"]),
  fileName: z.string().trim().nullable().optional(),
  assets: z.array(z.object({
    path: z.string().min(1),
    contentBase64: z.string().min(1),
  })).optional(),
});

const previewBuildFileSchema = z.object({
  path: z.string().trim().min(1),
  content: z.string().optional(),
  contentBase64: z.string().min(1).optional(),
}).refine((value) => typeof value.content === "string" || typeof value.contentBase64 === "string", {
  message: "Each preview source file must include content or contentBase64.",
});

const previewBuildRequestSchema = z.object({
  previewId: z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/),
  basePath: z.string().trim().optional(),
  entry: z.string().trim().optional(),
  title: z.string().trim().nullable().optional(),
  content: z.string().optional(),
  assets: z.array(z.object({
    path: z.string().min(1),
    contentBase64: z.string().min(1),
  })).optional(),
  source: z.object({
    files: z.array(previewBuildFileSchema).min(1),
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

function copyResponseHeaders(sourceHeaders, target) {
  for (const [key, value] of sourceHeaders.entries()) {
    if (key.toLowerCase() === "transfer-encoding") continue;
    target.setHeader(key, value);
  }
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
      res.status(400).json({ error: "Invalid Slidev preview request.", details: error.flatten() });
      return;
    }
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to start Slidev preview." });
  }
});

app.post("/api/render", async (req, res) => {
  try {
    const payload = renderJobRequestSchema.parse(req.body);
    const artifact = await renderArtifact(payload);
    res.json({
      jobId: artifact.jobId,
      format: artifact.format,
      fileName: artifact.fileName,
      artifactUrl: absolutize(req, artifact.artifactPath),
      siteUrl: artifact.format === "web" ? absolutize(req, artifact.artifactPath) : null,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Invalid Slidev render request.", details: error.flatten() });
      return;
    }
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to render slides." });
  }
});

app.post("/api/previews/build", async (req, res) => {
  try {
    const payload = previewBuildRequestSchema.parse(req.body);
    const preview = await buildPreviewSite(payload);
    res.json({
      previewId: preview.previewId,
      buildId: preview.buildId,
      basePath: preview.basePath,
      previewUrl: absolutize(req, preview.previewPath),
      manifest: preview.manifest,
      outputDir: preview.outputDir,
      manifestFilePath: preview.manifestFilePath,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Invalid Slidev preview build request.", details: error.flatten() });
      return;
    }
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to build Slidev preview." });
  }
});

app.use("/preview/:sessionId", async (req, res) => {
  const session = getPreviewSession(req.params.sessionId);
  if (!session?.port) {
    res.status(404).json({ error: "Slidev preview session not found." });
    return;
  }

  touchPreviewSession(session.id);

  try {
    const upstreamUrl = new URL(req.originalUrl, `http://localhost:${session.port}`);
    const upstream = await fetch(upstreamUrl, {
      method: req.method,
      headers: req.headers,
      redirect: "manual",
    });

    res.status(upstream.status);
    copyResponseHeaders(upstream.headers, res);

    if (!upstream.body || req.method === "HEAD") {
      res.end();
      return;
    }

    Readable.fromWeb(upstream.body).pipe(res);
  } catch (error) {
    res.status(502).json({ error: error instanceof Error ? error.message : "Failed to proxy Slidev preview." });
  }
});

app.use("/p/:previewId", async (req, res) => {
  const previewId = req.params.previewId;
  const pathname = decodeURIComponent(new URL(req.originalUrl, `${getOrigin(req)}/`).pathname);

  if (pathname === `/p/${previewId}`) {
    res.redirect(301, `${getOrigin(req)}/p/${previewId}/`);
    return;
  }

  const basePrefix = `/p/${previewId}/`;
  const subPath = pathname.startsWith(basePrefix) ? pathname.slice(basePrefix.length) : "";
  const previewRoot = join(ARTIFACT_ROOT, "previews", previewId);
  const manifestFilePath = join(previewRoot, "manifest.json");

  let manifest;
  try {
    manifest = JSON.parse(await readFile(manifestFilePath, "utf8"));
  } catch {
    res.status(404).json({ error: "Preview site not found." });
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

  const objectFilePath = join(previewRoot, safeObjectPath);
  if (await isFile(objectFilePath)) {
    res.sendFile(objectFilePath);
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

  const fallbackFilePath = join(previewRoot, entry);
  if (!await isFile(fallbackFilePath)) {
    res.status(404).send("Entry file not found");
    return;
  }

  res.type("html");
  res.sendFile(fallbackFilePath);
});

app.use("/artifacts", express.static(ARTIFACT_ROOT, { index: ["index.html"] }));

export async function startServer() {
  await mkdir(ARTIFACT_ROOT, { recursive: true });
  return app.listen(PORT, () => {
    console.log(`[slidev-renderer] listening on :${PORT}`);
  });
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] === currentFile) {
  await startServer();
}
