import "../load-env.mjs";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { getServerRuntimeConfig } from "../config/index.mjs";
import { startGrpcServer } from "./grpc-service.mjs";
import { ensurePreviewSession, getPreviewSession, touchPreviewSession } from "../preview-manager.mjs";
import { resolveManifestSiteRequest } from "../core/manifest-site.mjs";
import { isR2Configured, publishPreviewSiteToR2, publishRenderArtifactToR2 } from "../r2-client.mjs";
import {
  buildPreviewSite,
  cleanupExpiredLocalArtifacts,
  getCachedPreviewPublishResult,
  getCachedRenderPublishResult,
  renderArtifact,
  startArtifactCleanupScheduler,
  updateCachedPreviewPublishResult,
  updateCachedRenderPublishResult,
} from "../render-manager.mjs";

const {
  httpPort: PORT,
  publicBaseUrl: PUBLIC_BASE_URL,
  previewSiteBaseUrl: PREVIEW_SITE_BASE_URL,
  bodyLimit: BODY_LIMIT,
  corsOrigin: CORS_ORIGIN,
  rateLimitWindowMs: RATE_LIMIT_WINDOW_MS,
  rateLimitMax: RATE_LIMIT_MAX,
  requestTimeoutMs: REQUEST_TIMEOUT_MS,
} = getServerRuntimeConfig();
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
app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json({ limit: BODY_LIMIT }));

const apiRateLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
});
app.use("/api/", apiRateLimiter);

app.use("/api/", (req, res, next) => {
  res.setTimeout(REQUEST_TIMEOUT_MS, () => {
    if (!res.headersSent) {
      res.status(408).json({ error: "Request timeout." });
    }
  });
  next();
});

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

async function serveManifestSite({ req, res, rootDir, basePrefix, notFoundMessage }) {
  const pathname = decodeURIComponent(new URL(req.originalUrl, `${getOrigin(req)}/`).pathname);
  const resolved = await resolveManifestSiteRequest({
    rootDir,
    basePrefix,
    requestPathname: pathname,
  });

  if (resolved.type === "redirect") {
    res.redirect(resolved.status, `${getOrigin(req)}${resolved.location}`);
    return;
  }

  if (resolved.type === "error") {
    if (resolved.reason === "missing_manifest") {
      res.status(resolved.status).json({ error: notFoundMessage });
      return;
    }

    if (resolved.reason === "forbidden") {
      res.status(resolved.status).send("Forbidden");
      return;
    }

    if (resolved.reason === "invalid_path") {
      res.status(resolved.status).send("Invalid path");
      return;
    }

    if (resolved.reason === "asset_not_found") {
      res.status(resolved.status).send("Asset Not Found");
      return;
    }

    if (resolved.reason === "invalid_entry") {
      res.status(resolved.status).send("Invalid entry file");
      return;
    }

    if (resolved.reason === "entry_missing") {
      res.status(resolved.status).send("Entry file not found");
      return;
    }

    res.status(resolved.status).send("Not Found");
    return;
  }

  if (resolved.contentType === "text/html; charset=utf-8") {
    res.type("html");
  }
  await sendPreviewFile(res, rootDir, resolved.relativePath);
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
    console.error("[markos] preview session error:", error);
    res.status(500).json({ error: "Failed to start preview." });
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
    console.error("[markos] render error:", error);
    res.status(500).json({ error: "Failed to render presentation." });
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
    console.error("[markos] preview build error:", error);
    res.status(500).json({ error: "Failed to build preview site." });
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
    console.error("[markos] serve preview error:", error);
    res.status(500).json({ error: "Failed to serve preview." });
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
      console.error("[markos] serve preview site error:", error);
      res.status(500).json({ error: "Failed to serve preview site." });
    }
  }
});

app.use("/artifacts", express.static(RENDER_ARTIFACT_ROOT, { index: ["index.html"] }));

export async function startServer() {
  await mkdir(ARTIFACT_ROOT, { recursive: true });
  await mkdir(RENDER_ARTIFACT_ROOT, { recursive: true });
  await cleanupExpiredLocalArtifacts();
  startArtifactCleanupScheduler();
  const grpcServer = await startGrpcServer();
  const httpServer = app.listen(PORT, () => {
    console.log(`[markos] listening on :${PORT}`);
  });
  return { httpServer, grpcServer };
}
