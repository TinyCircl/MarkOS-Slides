import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { dirname, join } from "node:path";

const SESSION_IDLE_TTL_MS = Number(process.env.SLIDEV_SESSION_TTL_MS || 15 * 60 * 1000);
const SESSION_START_TIMEOUT_MS = 60 * 1000;
const SESSION_POLL_INTERVAL_MS = 250;
const LOG_BUFFER_LIMIT = 40;

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

function buildDeckMarkdown(input) {
  const title = normalizeTitle(input.title);
  const content = normalizeText(input.content).trim();

  if (!content) {
    return [
      "---",
      `title: ${JSON.stringify(title)}`,
      "theme: default",
      "mdc: true",
      "---",
      "",
      `# ${title}`,
      "",
      "Start writing to generate slides.",
      "",
    ].join("\n");
  }

  if (content.startsWith("---")) {
    return `${content}\n`;
  }

  return [
    "---",
    `title: ${JSON.stringify(title)}`,
    "theme: default",
    "mdc: true",
    "---",
    "",
    content,
    "",
  ].join("\n");
}

async function reservePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Failed to reserve Slidev preview port."));
        return;
      }

      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(address.port);
      });
    });
  });
}

function getPreviewDir(sessionId) {
  return join(process.cwd(), ".slidev-preview", sessionId);
}

function getSlidevCliPath() {
  return join(process.cwd(), "node_modules", "@slidev", "cli", "bin", "slidev.mjs");
}

function getBasePath(sessionId) {
  return `/preview/${sessionId}/`;
}

function appendLogs(session, chunk) {
  const nextLines = chunk
    .toString()
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!nextLines.length) return;

  session.logs.push(...nextLines);
  if (session.logs.length > LOG_BUFFER_LIMIT) {
    session.logs.splice(0, session.logs.length - LOG_BUFFER_LIMIT);
  }
}

async function waitForPreviewReady(session, child) {
  if (session.port == null) {
    throw new Error("Slidev preview port is missing.");
  }

  const readyUrl = `http://localhost:${session.port}${session.basePath}overview`;
  const startedAt = Date.now();

  while (Date.now() - startedAt < SESSION_START_TIMEOUT_MS) {
    if (child.exitCode !== null) {
      const logTail = session.logs.length > 0 ? `\n${session.logs.join("\n")}` : "";
      throw new Error(`Slidev exited before preview became ready.${logTail}`);
    }

    try {
      const response = await fetch(readyUrl, { cache: "no-store" });
      if (response.ok) {
        return;
      }
    } catch {
      // Ignore connection errors during startup.
    }

    await new Promise((resolve) => setTimeout(resolve, SESSION_POLL_INTERVAL_MS));
  }

  const logTail = session.logs.length > 0 ? `\n${session.logs.join("\n")}` : "";
  throw new Error(`Slidev preview startup timed out after ${SESSION_START_TIMEOUT_MS}ms.${logTail}`);
}

async function startPreviewProcess(session) {
  if (session.process && session.process.exitCode === null) {
    if (session.readyPromise) {
      await session.readyPromise;
    }
    return;
  }

  session.logs = [];
  session.port = await reservePort();

  const child = spawn(
    process.execPath,
    [
      getSlidevCliPath(),
      session.entryFilePath,
      "--port",
      String(session.port),
      "--base",
      session.basePath,
      "--log",
      "silent",
    ],
    {
      cwd: process.cwd(),
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    },
  );

  session.process = child;
  child.stdout.on("data", (chunk) => appendLogs(session, chunk));
  child.stderr.on("data", (chunk) => appendLogs(session, chunk));

  child.once("exit", () => {
    if (session.process === child) {
      session.process = null;
      session.readyPromise = null;
      session.port = null;
    }
  });

  session.readyPromise = waitForPreviewReady(session, child).catch((error) => {
    if (session.process === child && child.exitCode === null) {
      child.kill();
    }
    session.process = null;
    session.readyPromise = null;
    session.port = null;
    throw error;
  });

  await session.readyPromise;
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

    try {
      if (session.process && session.process.exitCode === null) {
        session.process.kill();
      }
    } finally {
      session.process = null;
      session.readyPromise = null;
      session.port = null;
      previewSessions.delete(session.id);
      await rm(getPreviewDir(session.id), { recursive: true, force: true }).catch(() => {});
    }
  }, SESSION_IDLE_TTL_MS);
}

export async function ensurePreviewSession(input) {
  const sessionId = buildSessionId(input);
  const existing = previewSessions.get(sessionId);
  const session = existing ?? {
    id: sessionId,
    port: null,
    basePath: getBasePath(sessionId),
    entryFilePath: join(getPreviewDir(sessionId), "slides.md"),
    process: null,
    readyPromise: null,
    startPromise: null,
    shutdownTimer: null,
    lastTouchedAt: Date.now(),
    logs: [],
  };

  session.lastTouchedAt = Date.now();
  previewSessions.set(sessionId, session);

  await mkdir(dirname(session.entryFilePath), { recursive: true });
  await writeFile(session.entryFilePath, buildDeckMarkdown(input), "utf8");

  if (!session.startPromise) {
    session.startPromise = startPreviewProcess(session).finally(() => {
      session.startPromise = null;
    });
  }

  await session.startPromise;
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
