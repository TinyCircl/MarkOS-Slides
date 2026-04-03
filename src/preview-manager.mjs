import {createHash} from "node:crypto";
import {rm} from "node:fs/promises";
import {join} from "node:path";
import {getPreviewSessionConfig} from "./config/index.mjs";
import {buildStaticSiteFromInput} from "./core/index.mjs";

const {
  sessionIdleTtlMs: SESSION_IDLE_TTL_MS,
  maxPreviewSessions: MAX_PREVIEW_SESSIONS,
} = getPreviewSessionConfig();

const previewSessions = new Map();

function evictOldestSession() {
  let oldest = null;
  for (const session of previewSessions.values()) {
    if (!oldest || session.lastTouchedAt < oldest.lastTouchedAt) {
      oldest = session;
    }
  }
  if (oldest) {
    if (oldest.shutdownTimer) clearTimeout(oldest.shutdownTimer);
    previewSessions.delete(oldest.id);
    void destroySessionArtifacts(oldest);
  }
}

function normalizeText(value) {
  return value.replace(/\r\n?/g, "\n");
}

function normalizeTitle(title) {
  const trimmed = title?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : "Untitled Slides";
}

function buildSessionId(input) {
  const stableIdentity = [input.projectId, input.cacheKey, input.documentId]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join("::");
  const source = stableIdentity || `${normalizeTitle(input.title)}\n${normalizeText(input.content)}`;
  return createHash("sha1").update(source).digest("hex").slice(0, 12);
}

function buildSessionContentHash(input) {
  return createHash("sha1")
    .update(`${normalizeTitle(input.title)}\n${normalizeText(input.content)}`)
    .digest("hex");
}

function getPreviewDir(sessionId) {
  return join(process.cwd(), ".markos-preview", sessionId);
}

function getPreviewWorkDir(sessionId) {
  return join(process.cwd(), ".markos-preview-work", sessionId);
}

function getBasePath(sessionId) {
  return `/preview/${sessionId}/`;
}

async function destroySessionArtifacts(session) {
  await rm(session.outputDir, { recursive: true, force: true }).catch((err) => {
    if (err?.code !== "ENOENT") console.warn("[markos] cleanup session output failed:", session.id, err.message);
  });
  await rm(session.workDir, { recursive: true, force: true }).catch((err) => {
    if (err?.code !== "ENOENT") console.warn("[markos] cleanup session workdir failed:", session.id, err.message);
  });
}

async function buildStaticPreviewSession(session, input) {
  const contentHash = buildSessionContentHash(input);
  if (session.contentHash === contentHash && session.ready) {
    return;
  }

  const buildId = contentHash.slice(0, 12);

  try {
    const builtPreview = await buildStaticSiteFromInput({
      input,
      outputDir: session.outputDir,
      basePath: session.basePath,
      workDir: session.workDir,
      manifest: {
        previewId: session.id,
        buildId,
      },
    });

    session.contentHash = contentHash;
    session.buildId = buildId;
    session.manifestFilePath = builtPreview.manifestFilePath;
    session.ready = true;
  } catch (error) {
    session.ready = false;
    session.contentHash = null;
    await destroySessionArtifacts(session);
    throw error;
  } finally {
    await rm(session.workDir, { recursive: true, force: true }).catch((err) => {
      if (err?.code !== "ENOENT") console.warn("[markos] cleanup session workdir failed:", session.id, err.message);
    });
  }
}

function scheduleSessionShutdown(session) {
  if (session.shutdownTimer) {
    clearTimeout(session.shutdownTimer);
  }

  session.shutdownTimer = setTimeout(async () => {
    const stillIdleFor = Date.now() - session.lastTouchedAt;
    if (stillIdleFor < SESSION_IDLE_TTL_MS) {
      scheduleSessionShutdown(session);
      return;
    }

    previewSessions.delete(session.id);
    await destroySessionArtifacts(session);
  }, SESSION_IDLE_TTL_MS);
}

export async function ensurePreviewSession(input) {
  const sessionId = buildSessionId(input);
  const existing = previewSessions.get(sessionId);
  const session = existing ?? {
    id: sessionId,
    basePath: getBasePath(sessionId),
    workDir: getPreviewWorkDir(sessionId),
    outputDir: getPreviewDir(sessionId),
    manifestFilePath: null,
    buildId: null,
    contentHash: null,
    buildPromise: null,
    shutdownTimer: null,
    lastTouchedAt: Date.now(),
    ready: false,
  };

  session.lastTouchedAt = Date.now();
  if (!existing && previewSessions.size >= MAX_PREVIEW_SESSIONS) {
    evictOldestSession();
  }
  previewSessions.set(sessionId, session);

  if (!session.buildPromise) {
    session.buildPromise = buildStaticPreviewSession(session, input).finally(() => {
      session.buildPromise = null;
    });
  }

  await session.buildPromise;
  scheduleSessionShutdown(session);

  return {
    sessionId,
    basePath: session.basePath,
    overviewPath: `${session.basePath}overview`,
    slidesPath: session.basePath,
    presenterPath: `${session.basePath}presenter`,
  };
}

export function getPreviewSession(sessionId) {
  return previewSessions.get(sessionId) ?? null;
}

export function touchPreviewSession(sessionId) {
  const session = previewSessions.get(sessionId);
  if (!session) return;
  session.lastTouchedAt = Date.now();
  scheduleSessionShutdown(session);
}

export async function disposePreviewSession(sessionId) {
  const session = previewSessions.get(sessionId);
  if (!session) {
    return;
  }
  if (session.shutdownTimer) {
    clearTimeout(session.shutdownTimer);
  }
  previewSessions.delete(sessionId);
  await destroySessionArtifacts(session);
}
