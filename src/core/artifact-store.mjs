import {mkdir, readFile, readdir, rm, stat, writeFile} from "node:fs/promises";
import {dirname, join, resolve} from "node:path";
import {isPathInside, sanitizePreviewId, sanitizeRelativePath} from "./path-utils.mjs";

const LOCAL_ARTIFACT_RETENTION_MS = Number(process.env.MARKOS_LOCAL_ARTIFACT_RETENTION_MS || 7 * 24 * 60 * 60 * 1000);
const LOCAL_ARTIFACT_CLEANUP_INTERVAL_MS = Number(process.env.MARKOS_LOCAL_ARTIFACT_CLEANUP_INTERVAL_MS || 60 * 60 * 1000);
const RENDER_ARTIFACTS_DIRNAME = "renders";
const PREVIEW_ARTIFACTS_DIRNAME = "previews";
const PREVIEW_BUILD_CACHE_DIRNAME = "preview-cache";
const RENDER_BUILD_CACHE_DIRNAME = "render-cache";

const renderArtifactCleanupTimers = new Map();
let artifactCleanupTimer = null;
let artifactCleanupRun = null;

export function getWorkDir(jobId) {
    return join(process.cwd(), ".markos-workspaces", jobId);
}

export function getArtifactDir(jobId) {
    return join(process.cwd(), ".markos-artifacts", RENDER_ARTIFACTS_DIRNAME, jobId);
}

export function getPreviewArtifactDir(previewId) {
    return join(process.cwd(), ".markos-artifacts", PREVIEW_ARTIFACTS_DIRNAME, sanitizePreviewId(previewId));
}

function getPreviewBuildCacheFilePath(previewId) {
    return join(process.cwd(), ".markos-artifacts", PREVIEW_BUILD_CACHE_DIRNAME, `${sanitizePreviewId(previewId)}.json`);
}

export function getRenderBuildCacheFilePath(cacheKey) {
    return join(process.cwd(), ".markos-artifacts", RENDER_BUILD_CACHE_DIRNAME, `${cacheKey}.json`);
}

function getPreviewArtifactsRootDir() {
    return join(process.cwd(), ".markos-artifacts", PREVIEW_ARTIFACTS_DIRNAME);
}

function getRenderArtifactsRootDir() {
    return join(process.cwd(), ".markos-artifacts", RENDER_ARTIFACTS_DIRNAME);
}

function getPreviewCacheRootDir() {
    return join(process.cwd(), ".markos-artifacts", PREVIEW_BUILD_CACHE_DIRNAME);
}

function getRenderCacheRootDir() {
    return join(process.cwd(), ".markos-artifacts", RENDER_BUILD_CACHE_DIRNAME);
}

function parseCreatedAt(value) {
    const createdAtMs = Date.parse(String(value ?? ""));
    return Number.isFinite(createdAtMs) ? createdAtMs : null;
}

function isExpired(createdAt, now = Date.now()) {
    const createdAtMs = parseCreatedAt(createdAt);
    if (createdAtMs == null) {
        return true;
    }
    return now - createdAtMs >= LOCAL_ARTIFACT_RETENTION_MS;
}

async function listSubdirectories(rootDir) {
    try {
        const entries = await readdir(rootDir, {withFileTypes: true});
        return entries
            .filter((entry) => entry.isDirectory())
            .map((entry) => join(rootDir, entry.name));
    } catch {
        return [];
    }
}

async function removeDirIfExists(dirPath) {
    await rm(dirPath, {recursive: true, force: true}).catch(() => {
    });
}

async function removeFileIfExists(filePath) {
    await rm(filePath, {force: true}).catch(() => {
    });
}

export async function writeSourceFiles(rootDir, files = []) {
    for (const file of files) {
        const relativePath = sanitizeRelativePath(file.path);
        const targetPath = join(rootDir, relativePath);
        await mkdir(dirname(targetPath), {recursive: true});
        if (typeof file.content === "string") {
            await writeFile(targetPath, file.content, "utf8");
            continue;
        }
        await writeFile(targetPath, Buffer.from(file.contentBase64, "base64"));
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

async function readJsonFile(filePath) {
    try {
        return JSON.parse(await readFile(filePath, "utf8"));
    } catch {
        return null;
    }
}

export function scheduleRenderArtifactCleanup(jobId, {cacheFilePath} = {}) {
    const existingTimer = renderArtifactCleanupTimers.get(jobId);
    if (existingTimer) {
        clearTimeout(existingTimer);
    }

    const timer = setTimeout(() => {
        renderArtifactCleanupTimers.delete(jobId);
        void rm(getArtifactDir(jobId), {recursive: true, force: true}).catch(() => {
        });
        if (cacheFilePath) {
            void rm(cacheFilePath, {force: true}).catch(() => {
            });
        }
    }, LOCAL_ARTIFACT_RETENTION_MS);

    renderArtifactCleanupTimers.set(jobId, timer);
}

async function listRelativeFiles(rootDir, currentDir = rootDir) {
    const entries = await readdir(currentDir, {withFileTypes: true});
    const results = [];

    for (const entry of entries) {
        const absolutePath = join(currentDir, entry.name);
        if (entry.isDirectory()) {
            results.push(...await listRelativeFiles(rootDir, absolutePath));
            continue;
        }
        if (!entry.isFile()) {
            continue;
        }
        results.push(absolutePath.slice(rootDir.length + 1).replace(/\\/g, "/"));
    }

    return results.sort((left, right) => left.localeCompare(right));
}

async function readPreviewBuildCache(previewId) {
    return readJsonFile(getPreviewBuildCacheFilePath(previewId));
}

async function readRenderBuildCache(cacheKey) {
    return readJsonFile(getRenderBuildCacheFilePath(cacheKey));
}

export async function writePreviewBuildCache({
    version,
    previewId,
    buildId,
    basePath,
    sourceEntry,
    sourceHash,
    outputDir,
    manifestFilePath,
    createdAt,
    publishResult,
}) {
    const cacheFilePath = getPreviewBuildCacheFilePath(previewId);
    await mkdir(dirname(cacheFilePath), {recursive: true});
    await writeFile(cacheFilePath, `${JSON.stringify({
        version,
        previewId,
        buildId,
        basePath,
        sourceEntry,
        sourceHash,
        outputDir,
        manifestFilePath,
        createdAt,
        publishResult: publishResult ?? null,
    }, null, 2)}\n`, "utf8");
}

export async function writeRenderBuildCache({
    version,
    cacheKey,
    jobId,
    format,
    outputFileName,
    artifactPath,
    artifactDir,
    artifactFilePath,
    outputDir,
    sourceHash,
    createdAt,
    publishResult,
}) {
    const cacheFilePath = getRenderBuildCacheFilePath(cacheKey);
    await mkdir(dirname(cacheFilePath), {recursive: true});
    await writeFile(cacheFilePath, `${JSON.stringify({
        version,
        cacheKey,
        jobId,
        format,
        outputFileName,
        artifactPath,
        artifactDir,
        artifactFilePath: artifactFilePath ?? null,
        outputDir: outputDir ?? null,
        sourceHash,
        createdAt,
        publishResult: publishResult ?? null,
    }, null, 2)}\n`, "utf8");
}

export async function resolveCachedPreviewBuild({
    version,
    previewId,
    basePath,
    sourceEntry,
    sourceHash,
    outputDir,
    manifestFilePath,
}) {
    const cache = await readPreviewBuildCache(previewId);
    if (!cache) {
        return null;
    }

    if (
        cache.version !== version
        || cache.previewId !== previewId
        || cache.basePath !== basePath
        || cache.sourceEntry !== sourceEntry
        || cache.sourceHash !== sourceHash
    ) {
        return null;
    }

    const manifest = await readJsonFile(manifestFilePath);
    if (!manifest || manifest.buildId !== cache.buildId) {
        return null;
    }

    const entry = typeof manifest.entry === "string" && manifest.entry ? manifest.entry : "index.html";
    if (!await isFile(join(outputDir, entry))) {
        return null;
    }

    return {
        buildId: cache.buildId,
        previewId,
        basePath,
        sourceEntry,
        sourceHash,
        previewPath: basePath,
        outputDir,
        manifest,
        manifestFilePath,
        cacheHit: true,
    };
}

export async function resolveCachedRenderArtifact({
    version,
    cacheKey,
    sourceHash,
    format,
}) {
    const cache = await readRenderBuildCache(cacheKey);
    if (!cache) {
        return null;
    }

    if (
        cache.version !== version
        || cache.cacheKey !== cacheKey
        || cache.sourceHash !== sourceHash
        || cache.format !== format
        || typeof cache.jobId !== "string"
        || typeof cache.artifactPath !== "string"
        || typeof cache.outputFileName !== "string"
        || typeof cache.artifactDir !== "string"
    ) {
        return null;
    }

    if (format === "web") {
        const outputDir = typeof cache.outputDir === "string" ? cache.outputDir : join(cache.artifactDir, "web");
        if (!await isFile(join(outputDir, "index.html"))) {
            return null;
        }

        return {
            jobId: cache.jobId,
            format,
            artifactPath: cache.artifactPath,
            fileName: cache.outputFileName,
            artifactDir: cache.artifactDir,
            artifactFilePath: null,
            outputDir,
            sourceHash,
            cacheKey,
            cacheHit: true,
        };
    }

    if (typeof cache.artifactFilePath !== "string" || !await isFile(cache.artifactFilePath)) {
        return null;
    }

    return {
        jobId: cache.jobId,
        format,
        artifactPath: cache.artifactPath,
        fileName: cache.outputFileName,
        artifactDir: cache.artifactDir,
        artifactFilePath: cache.artifactFilePath,
        outputDir: null,
        sourceHash,
        cacheKey,
        cacheHit: true,
    };
}

export async function getCachedPreviewPublishResult({previewId, buildId}) {
    const cache = await readPreviewBuildCache(previewId);
    if (!cache || cache.buildId !== buildId || !cache.publishResult) {
        return null;
    }

    return cache.publishResult;
}

export async function updateCachedPreviewPublishResult({previewId, buildId, publishResult}) {
    const cache = await readPreviewBuildCache(previewId);
    if (!cache || cache.buildId !== buildId) {
        return;
    }

    await writePreviewBuildCache({
        version: cache.version,
        previewId,
        buildId,
        basePath: cache.basePath,
        sourceEntry: cache.sourceEntry,
        sourceHash: cache.sourceHash,
        outputDir: cache.outputDir,
        manifestFilePath: cache.manifestFilePath,
        createdAt: cache.createdAt,
        publishResult,
    });
}

export async function getCachedRenderPublishResult({cacheKey, jobId}) {
    const cache = await readRenderBuildCache(cacheKey);
    if (!cache || cache.jobId !== jobId || !cache.publishResult) {
        return null;
    }

    return cache.publishResult;
}

export async function updateCachedRenderPublishResult({cacheKey, jobId, publishResult}) {
    const cache = await readRenderBuildCache(cacheKey);
    if (!cache || cache.jobId !== jobId) {
        return;
    }

    await writeRenderBuildCache({
        version: cache.version,
        cacheKey,
        jobId,
        format: cache.format,
        outputFileName: cache.outputFileName,
        artifactPath: cache.artifactPath,
        artifactDir: cache.artifactDir,
        artifactFilePath: cache.artifactFilePath,
        outputDir: cache.outputDir,
        sourceHash: cache.sourceHash,
        createdAt: cache.createdAt,
        publishResult,
    });
}

async function cleanupPreviewArtifacts({now, retainedDirs}) {
    const previewArtifactsRootDir = getPreviewArtifactsRootDir();
    const previewCacheRootDir = getPreviewCacheRootDir();

    try {
        const cacheEntries = await readdir(previewCacheRootDir, {withFileTypes: true});
        for (const entry of cacheEntries) {
            if (!entry.isFile() || !entry.name.endsWith(".json")) {
                continue;
            }

            const cacheFilePath = join(previewCacheRootDir, entry.name);
            const cache = await readJsonFile(cacheFilePath);
            if (!cache || isExpired(cache.createdAt, now)) {
                const outputDir = typeof cache?.outputDir === "string" && isPathInside(resolve(previewArtifactsRootDir), resolve(cache.outputDir))
                    ? cache.outputDir
                    : null;
                if (outputDir) {
                    await removeDirIfExists(outputDir);
                }
                await removeFileIfExists(cacheFilePath);
                continue;
            }

            if (typeof cache.outputDir === "string" && isPathInside(resolve(previewArtifactsRootDir), resolve(cache.outputDir))) {
                retainedDirs.add(resolve(cache.outputDir).toLowerCase());
            }
        }
    } catch {
    }

    for (const dirPath of await listSubdirectories(previewArtifactsRootDir)) {
        if (retainedDirs.has(resolve(dirPath).toLowerCase())) {
            continue;
        }

        try {
            const fileStat = await stat(dirPath);
            if (now - fileStat.mtimeMs >= LOCAL_ARTIFACT_RETENTION_MS) {
                await removeDirIfExists(dirPath);
            }
        } catch {
        }
    }
}

async function cleanupRenderArtifacts({now, retainedDirs}) {
    const renderArtifactsRootDir = getRenderArtifactsRootDir();
    const renderCacheRootDir = getRenderCacheRootDir();

    try {
        const cacheEntries = await readdir(renderCacheRootDir, {withFileTypes: true});
        for (const entry of cacheEntries) {
            if (!entry.isFile() || !entry.name.endsWith(".json")) {
                continue;
            }

            const cacheFilePath = join(renderCacheRootDir, entry.name);
            const cache = await readJsonFile(cacheFilePath);
            if (!cache || isExpired(cache.createdAt, now)) {
                const artifactDir = typeof cache?.artifactDir === "string" && isPathInside(resolve(renderArtifactsRootDir), resolve(cache.artifactDir))
                    ? cache.artifactDir
                    : null;
                if (artifactDir && typeof cache?.jobId === "string") {
                    const existingTimer = renderArtifactCleanupTimers.get(cache.jobId);
                    if (existingTimer) {
                        clearTimeout(existingTimer);
                        renderArtifactCleanupTimers.delete(cache.jobId);
                    }
                }
                if (artifactDir) {
                    await removeDirIfExists(artifactDir);
                }
                await removeFileIfExists(cacheFilePath);
                continue;
            }

            if (typeof cache.artifactDir === "string" && isPathInside(resolve(renderArtifactsRootDir), resolve(cache.artifactDir))) {
                retainedDirs.add(resolve(cache.artifactDir).toLowerCase());
            }
        }
    } catch {
    }

    for (const dirPath of await listSubdirectories(renderArtifactsRootDir)) {
        if (retainedDirs.has(resolve(dirPath).toLowerCase())) {
            continue;
        }

        try {
            const fileStat = await stat(dirPath);
            if (now - fileStat.mtimeMs >= LOCAL_ARTIFACT_RETENTION_MS) {
                await removeDirIfExists(dirPath);
            }
        } catch {
        }
    }
}

export async function cleanupExpiredLocalArtifacts({now = Date.now()} = {}) {
    if (artifactCleanupRun) {
        return artifactCleanupRun;
    }

    artifactCleanupRun = (async () => {
        const retainedPreviewDirs = new Set();
        const retainedRenderDirs = new Set();

        await cleanupPreviewArtifacts({now, retainedDirs: retainedPreviewDirs});
        await cleanupRenderArtifacts({now, retainedDirs: retainedRenderDirs});
    })().finally(() => {
        artifactCleanupRun = null;
    });

    return artifactCleanupRun;
}

export function startArtifactCleanupScheduler() {
    if (artifactCleanupTimer) {
        return;
    }

    void cleanupExpiredLocalArtifacts();
    artifactCleanupTimer = setInterval(() => {
        void cleanupExpiredLocalArtifacts();
    }, LOCAL_ARTIFACT_CLEANUP_INTERVAL_MS);
    artifactCleanupTimer.unref?.();
}

export async function writePreviewManifest({previewId, buildId, basePath, outputDir, sourceEntry}) {
    const files = await listRelativeFiles(outputDir);
    const assetPrefixes = [...new Set(
        files
            .map((file) => {
                const slashIndex = file.indexOf("/");
                return slashIndex >= 0 ? `${file.slice(0, slashIndex + 1)}` : "";
            })
            .filter(Boolean),
    )];
    const manifest = {
        id: previewId,
        buildId,
        basePath,
        entry: "index.html",
        spaFallback: true,
        assetPrefixes,
        privateFiles: ["manifest.json"],
        sourceEntry,
        files,
        createdAt: new Date().toISOString(),
    };

    const manifestFilePath = join(outputDir, "manifest.json");
    await writeFile(manifestFilePath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    return {
        manifest,
        manifestFilePath,
    };
}
