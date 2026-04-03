import {statSync} from "node:fs";
import {basename, dirname, join, resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {normalizeBasePath} from "../core/path-utils.mjs";
import {MARKOS_SOURCE_MODES} from "../core/source-pipeline.mjs";

export const MARKOS_DEFAULT_ENTRY = "slides.md";
export const MARKOS_DEFAULT_DECK_DIR = ".";
export const MARKOS_THEMES_DIRNAME = "themes";
export const MARKOS_DEFAULT_BASE_PATH = "/";
export const MARKOS_DEFAULT_BUILD_OUT_DIRNAME = "dist";
export const MARKOS_DEFAULT_DEV_OUT_DIRNAME = ".markos-dev";
export const MARKOS_DEFAULT_WORK_ROOT_DIRNAME = ".markos-work";
export const MARKOS_DEFAULT_DEV_HOST = "127.0.0.1";
export const MARKOS_DEFAULT_DEV_PORT = 3030;
export const MARKOS_DEFAULT_HTTP_PORT = 3210;
export const MARKOS_DEFAULT_GRPC_PORT = 50051;
export const MARKOS_DEFAULT_BODY_LIMIT = "20mb";
export const MARKOS_DEFAULT_SESSION_TTL_MS = 15 * 60 * 1000;
export const MARKOS_DEFAULT_LOCAL_ARTIFACT_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
export const MARKOS_DEFAULT_LOCAL_ARTIFACT_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
export const MARKOS_DEFAULT_GRPC_HOST = "127.0.0.1";
export const MARKOS_DEFAULT_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
export const MARKOS_DEFAULT_RATE_LIMIT_MAX = 100;
export const MARKOS_DEFAULT_REQUEST_TIMEOUT_MS = 60 * 1000;
export const MARKOS_DEFAULT_MAX_PREVIEW_SESSIONS = 1000;
export const MARKOS_DEFAULT_AUTHORING_MODE = MARKOS_SOURCE_MODES.AUTHORING;
export const MARKOS_DEFAULT_HOSTED_MODE = MARKOS_SOURCE_MODES.HOSTED;
const CORE_CONFIG_DIR = dirname(fileURLToPath(import.meta.url));
const CORE_PACKAGE_ROOT = resolve(CORE_CONFIG_DIR, "../..");

function parseNumber(value, fallback, {min = 0} = {}) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < min) {
        return fallback;
    }
    return parsed;
}

function normalizeUrlBase(value) {
    const trimmed = value?.trim();
    if (!trimmed) {
        return null;
    }
    return trimmed.replace(/\/$/, "");
}

export function resolveSourceMode(mode) {
    return mode === MARKOS_SOURCE_MODES.AUTHORING
        ? MARKOS_SOURCE_MODES.AUTHORING
        : MARKOS_SOURCE_MODES.HOSTED;
}

function parseCorsOrigin(value) {
    const trimmed = value?.trim();
    if (!trimmed || trimmed === "true") return true;
    if (trimmed === "false") return false;
    return trimmed.split(",").map((s) => s.trim()).filter(Boolean);
}

export function getServerRuntimeConfig(env = process.env) {
    return {
        httpPort: parseNumber(env.PORT, MARKOS_DEFAULT_HTTP_PORT),
        grpcPort: parseNumber(env.GRPC_PORT, MARKOS_DEFAULT_GRPC_PORT),
        grpcHost: env.MARKOS_GRPC_HOST?.trim() || MARKOS_DEFAULT_GRPC_HOST,
        publicBaseUrl: normalizeUrlBase(env.MARKOS_PUBLIC_BASE_URL),
        previewSiteBaseUrl: normalizeUrlBase(env.MARKOS_PREVIEW_SITE_BASE_URL),
        bodyLimit: env.MARKOS_BODY_LIMIT || MARKOS_DEFAULT_BODY_LIMIT,
        corsOrigin: parseCorsOrigin(env.MARKOS_CORS_ORIGIN),
        rateLimitWindowMs: parseNumber(env.MARKOS_RATE_LIMIT_WINDOW_MS, MARKOS_DEFAULT_RATE_LIMIT_WINDOW_MS, {min: 1}),
        rateLimitMax: parseNumber(env.MARKOS_RATE_LIMIT_MAX, MARKOS_DEFAULT_RATE_LIMIT_MAX, {min: 1}),
        requestTimeoutMs: parseNumber(env.MARKOS_REQUEST_TIMEOUT_MS, MARKOS_DEFAULT_REQUEST_TIMEOUT_MS, {min: 1}),
    };
}

export function getPreviewSessionConfig(env = process.env) {
    return {
        sessionIdleTtlMs: parseNumber(env.MARKOS_SESSION_TTL_MS, MARKOS_DEFAULT_SESSION_TTL_MS, {min: 1}),
        maxPreviewSessions: parseNumber(env.MARKOS_MAX_PREVIEW_SESSIONS, MARKOS_DEFAULT_MAX_PREVIEW_SESSIONS, {min: 1}),
    };
}

export function getArtifactStoreConfig(env = process.env) {
    return {
        localArtifactRetentionMs: parseNumber(
            env.MARKOS_LOCAL_ARTIFACT_RETENTION_MS,
            MARKOS_DEFAULT_LOCAL_ARTIFACT_RETENTION_MS,
            {min: 1},
        ),
        localArtifactCleanupIntervalMs: parseNumber(
            env.MARKOS_LOCAL_ARTIFACT_CLEANUP_INTERVAL_MS,
            MARKOS_DEFAULT_LOCAL_ARTIFACT_CLEANUP_INTERVAL_MS,
            {min: 1},
        ),
    };
}

export function getCliRuntimeOptions(overrides = {}) {
    return {
        command: overrides.command || "help",
        entry: overrides.entry || MARKOS_DEFAULT_DECK_DIR,
        outDir: overrides.outDir || null,
        workDir: overrides.workDir || null,
        basePath: normalizeBasePath(overrides.base ?? MARKOS_DEFAULT_BASE_PATH, {
            fallback: MARKOS_DEFAULT_BASE_PATH,
        }),
        host: overrides.host || MARKOS_DEFAULT_DEV_HOST,
        port: parseNumber(overrides.port, MARKOS_DEFAULT_DEV_PORT),
        projectRoot: overrides.projectRoot || null,
        title: overrides.title || "",
        sourceMode: MARKOS_DEFAULT_AUTHORING_MODE,
    };
}

export function getBundledThemesRoot() {
    return join(CORE_PACKAGE_ROOT, MARKOS_THEMES_DIRNAME);
}

function isDirectoryPath(targetPath) {
    try {
        return statSync(targetPath).isDirectory();
    } catch {
        return false;
    }
}

export function resolveCliPaths(overrides = {}) {
    const options = getCliRuntimeOptions(overrides);
    const deckRoot = resolve(options.entry);
    if (!isDirectoryPath(deckRoot)) {
        throw new Error(`Deck path must be a directory containing ${MARKOS_DEFAULT_ENTRY}: ${deckRoot}`);
    }

    const entryFilePath = resolve(deckRoot, MARKOS_DEFAULT_ENTRY);
    const projectRoot = resolve(options.projectRoot || deckRoot);
    const defaultOutDirName = options.command === "dev"
        ? MARKOS_DEFAULT_DEV_OUT_DIRNAME
        : MARKOS_DEFAULT_BUILD_OUT_DIRNAME;
    const outDir = resolve(options.outDir || resolve(dirname(entryFilePath), defaultOutDirName));
    const workDirName = basename(outDir);
    const workDir = resolve(
        options.workDir || resolve(dirname(entryFilePath), MARKOS_DEFAULT_WORK_ROOT_DIRNAME, workDirName),
    );

    return {
        ...options,
        entryFilePath,
        projectRoot,
        outDir,
        workDir,
    };
}
