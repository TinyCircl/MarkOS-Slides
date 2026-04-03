import {basename, dirname, resolve} from "node:path";
import {normalizeBasePath} from "../core/path-utils.mjs";
import {MARKOS_SOURCE_MODES} from "../core/source-pipeline.mjs";

export const MARKOS_DEFAULT_ENTRY = "slides.md";
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
export const MARKOS_DEFAULT_AUTHORING_MODE = MARKOS_SOURCE_MODES.AUTHORING;
export const MARKOS_DEFAULT_HOSTED_MODE = MARKOS_SOURCE_MODES.HOSTED;

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

export function getServerRuntimeConfig(env = process.env) {
    return {
        httpPort: parseNumber(env.PORT, MARKOS_DEFAULT_HTTP_PORT),
        grpcPort: parseNumber(env.GRPC_PORT, MARKOS_DEFAULT_GRPC_PORT),
        publicBaseUrl: normalizeUrlBase(env.MARKOS_PUBLIC_BASE_URL),
        previewSiteBaseUrl: normalizeUrlBase(env.MARKOS_PREVIEW_SITE_BASE_URL),
        bodyLimit: env.MARKOS_BODY_LIMIT || MARKOS_DEFAULT_BODY_LIMIT,
    };
}

export function getPreviewSessionConfig(env = process.env) {
    return {
        sessionIdleTtlMs: parseNumber(env.MARKOS_SESSION_TTL_MS, MARKOS_DEFAULT_SESSION_TTL_MS, {min: 1}),
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
        entry: overrides.entry || MARKOS_DEFAULT_ENTRY,
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

export function resolveCliPaths(overrides = {}) {
    const options = getCliRuntimeOptions(overrides);
    const entryFilePath = resolve(options.entry);
    const projectRoot = resolve(options.projectRoot || dirname(entryFilePath));
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
