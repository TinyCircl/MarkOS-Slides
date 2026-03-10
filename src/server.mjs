import cors from "cors";
import express from "express";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { ensurePreviewSession, getPreviewSession, touchPreviewSession } from "./preview-manager.mjs";
import { renderArtifact } from "./render-manager.mjs";

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
