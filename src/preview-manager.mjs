import {createHash} from "node:crypto";
import {mkdir, rm, writeFile} from "node:fs/promises";
import {dirname, join} from "node:path";
import {buildDeckMarkdown} from "./core/source-pipeline.mjs";
import {writePreviewManifest} from "./core/artifact-store.mjs";
import {getRenderEngine} from "./engines/index.mjs";

const SESSION_IDLE_TTL_MS = Number(process.env.MARKOS_SESSION_TTL_MS || 15 * 60 * 1000);

const previewSessions = new Map();

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
  await rm(session.outputDir, { recursive: true, force: true }).catch(() => {});
  await rm(session.workDir, { recursive: true, force: true }).catch(() => {});
}

async function buildStaticPreviewSession(session, input) {
  const renderEngine = getRenderEngine();
  const contentHash = buildSessionContentHash(input);
  if (session.contentHash === contentHash && session.ready) {
    return;
  }

  await rm(session.workDir, { recursive: true, force: true }).catch(() => {});
  await rm(session.outputDir, { recursive: true, force: true }).catch(() => {});
  await mkdir(dirname(session.entryFilePath), { recursive: true });
  await writeFile(session.entryFilePath, buildDeckMarkdown(input), "utf8");

  try {
    await renderEngine.buildStaticSite({
      entryFilePath: session.entryFilePath,
      outputDir: session.outputDir,
      basePath: session.basePath,
      cwd: session.workDir,
    });

    const buildId = contentHash.slice(0, 12);
    const { manifestFilePath } = await writePreviewManifest({
      previewId: session.id,
      buildId,
      basePath: session.basePath,
      outputDir: session.outputDir,
      sourceEntry: "slides.md",
    });

    session.contentHash = contentHash;
    session.buildId = buildId;
    session.manifestFilePath = manifestFilePath;
    session.ready = true;
  } catch (error) {
    session.ready = false;
    session.contentHash = null;
    await destroySessionArtifacts(session);
    throw error;
  } finally {
    await rm(session.workDir, { recursive: true, force: true }).catch(() => {});
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
    entryFilePath: join(getPreviewWorkDir(sessionId), "slides.md"),
    manifestFilePath: null,
    buildId: null,
    contentHash: null,
    buildPromise: null,
    shutdownTimer: null,
    lastTouchedAt: Date.now(),
    ready: false,
  };

  session.lastTouchedAt = Date.now();
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
