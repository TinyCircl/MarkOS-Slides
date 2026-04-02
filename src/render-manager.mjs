import {randomUUID} from "node:crypto";
import {mkdir, rm} from "node:fs/promises";
import {join} from "node:path";
import {
    buildDeckMarkdown,
    buildRenderOutputMetadata,
    createInlineSourceFiles,
    createPreviewSourceHash,
    createRenderArtifactSourceHash,
    ensureSourceEntryExists,
} from "./core/source-pipeline.mjs";
import {
    cleanupExpiredLocalArtifacts,
    getArtifactDir,
    getCachedPreviewPublishResult,
    getCachedRenderPublishResult,
    getPreviewArtifactDir,
    getRenderBuildCacheFilePath,
    getWorkDir,
    resolveCachedPreviewBuild,
    resolveCachedRenderArtifact,
    scheduleRenderArtifactCleanup,
    startArtifactCleanupScheduler,
    updateCachedPreviewPublishResult,
    updateCachedRenderPublishResult,
    writePreviewBuildCache,
    writePreviewManifest,
    writeRenderBuildCache,
    writeSourceFiles,
} from "./core/artifact-store.mjs";
import {normalizePreviewBasePath, sanitizePreviewId} from "./core/path-utils.mjs";
import {getRenderEngine} from "./engines/index.mjs";

const PREVIEW_BUILD_CACHE_VERSION = 2;
const RENDER_BUILD_CACHE_VERSION = 2;

export {
    buildDeckMarkdown,
    createInlineSourceFiles,
    cleanupExpiredLocalArtifacts,
    getCachedPreviewPublishResult,
    getCachedRenderPublishResult,
    startArtifactCleanupScheduler,
    updateCachedPreviewPublishResult,
    updateCachedRenderPublishResult,
};

export async function renderArtifact(input) {
    const renderEngine = getRenderEngine();
    const {outputFileName} = buildRenderOutputMetadata(input);
    const sourceFiles = createInlineSourceFiles(input);
    const sourceEntry = ensureSourceEntryExists(sourceFiles, input.entry || "slides.md");
    const sourceHash = createRenderArtifactSourceHash({
        version: RENDER_BUILD_CACHE_VERSION,
        format: input.format,
        outputFileName,
        sourceEntry,
        sourceFiles,
    });
    const cacheKey = sourceHash;

    const cachedArtifact = await resolveCachedRenderArtifact({
        version: RENDER_BUILD_CACHE_VERSION,
        cacheKey,
        sourceHash,
        format: input.format,
    });
    if (cachedArtifact) {
        scheduleRenderArtifactCleanup(cachedArtifact.jobId, {
            cacheFilePath: getRenderBuildCacheFilePath(cacheKey),
        });
        return cachedArtifact;
    }

    const jobId = randomUUID();
    const workDir = getWorkDir(jobId);
    const artifactDir = getArtifactDir(jobId);
    const entryFilePath = join(workDir, sourceEntry);
    const cacheFilePath = getRenderBuildCacheFilePath(cacheKey);

    await rm(workDir, {recursive: true, force: true});
    await rm(artifactDir, {recursive: true, force: true});
    await mkdir(workDir, {recursive: true});
    await mkdir(artifactDir, {recursive: true});

    try {
        await writeSourceFiles(workDir, sourceFiles);

        if (input.format === "web") {
            const outDir = join(artifactDir, "web");
            const artifactPath = `/artifacts/${jobId}/web/`;
            await renderEngine.buildStaticSite({
                entryFilePath,
                outputDir: outDir,
                basePath: artifactPath,
                cwd: workDir,
            });

            await writeRenderBuildCache({
                version: RENDER_BUILD_CACHE_VERSION,
                cacheKey,
                jobId,
                format: "web",
                outputFileName,
                artifactPath,
                artifactDir,
                artifactFilePath: null,
                outputDir: outDir,
                sourceHash,
                createdAt: new Date().toISOString(),
            });

            scheduleRenderArtifactCleanup(jobId, {cacheFilePath});
            return {
                jobId,
                format: "web",
                artifactPath,
                fileName: outputFileName,
                artifactDir,
                artifactFilePath: null,
                outputDir: outDir,
                sourceHash,
                cacheKey,
                cacheHit: false,
            };
        }

        const outputFilePath = join(artifactDir, outputFileName);
        const artifactPath = `/artifacts/${jobId}/${outputFileName}`;

        await renderEngine.exportArtifact({
            entryFilePath,
            format: input.format,
            outputFilePath,
            cwd: workDir,
        });

        await writeRenderBuildCache({
            version: RENDER_BUILD_CACHE_VERSION,
            cacheKey,
            jobId,
            format: input.format,
            outputFileName,
            artifactPath,
            artifactDir,
            artifactFilePath: outputFilePath,
            outputDir: null,
            sourceHash,
            createdAt: new Date().toISOString(),
        });

        scheduleRenderArtifactCleanup(jobId, {cacheFilePath});
        return {
            jobId,
            format: input.format,
            artifactPath,
            fileName: outputFileName,
            artifactDir,
            artifactFilePath: outputFilePath,
            outputDir: null,
            sourceHash,
            cacheKey,
            cacheHit: false,
        };
    } catch (error) {
        await rm(cacheFilePath, {force: true}).catch(() => {
        });
        await rm(artifactDir, {recursive: true, force: true}).catch(() => {
        });
        throw error;
    } finally {
        await rm(workDir, {recursive: true, force: true}).catch(() => {
        });
    }
}

export async function buildPreviewSite(input) {
    const renderEngine = getRenderEngine();
    const previewId = sanitizePreviewId(input.previewId);
    const basePath = normalizePreviewBasePath(previewId, input.basePath);
    const sourceFiles = createInlineSourceFiles(input);
    const sourceEntry = ensureSourceEntryExists(sourceFiles, input.entry || "slides.md");
    const outputDir = getPreviewArtifactDir(previewId);
    const manifestFilePath = join(outputDir, "manifest.json");
    const sourceHash = createPreviewSourceHash({
        version: PREVIEW_BUILD_CACHE_VERSION,
        basePath,
        sourceEntry,
        sourceFiles,
    });

    console.log(`[build] BuildPreviewSite start: previewId=${previewId}, sourceHash=${sourceHash.slice(0, 12)}...`);

    const cachedPreview = await resolveCachedPreviewBuild({
        version: PREVIEW_BUILD_CACHE_VERSION,
        previewId,
        basePath,
        sourceEntry,
        sourceHash,
        outputDir,
        manifestFilePath,
    });
    if (cachedPreview) {
        console.log(`[build] Cache hit: previewId=${previewId}, buildId=${cachedPreview.buildId}`);
        return cachedPreview;
    }
    console.log(`[build] Cache miss: previewId=${previewId}, starting fresh build...`);

    const buildId = randomUUID();
    const workDir = getWorkDir(buildId);
    const entryFilePath = join(workDir, sourceEntry);

    await rm(workDir, {recursive: true, force: true});
    await rm(outputDir, {recursive: true, force: true});
    await mkdir(workDir, {recursive: true});
    await mkdir(outputDir, {recursive: true});

    try {
        await writeSourceFiles(workDir, sourceFiles);
        const engineStartedAt = Date.now();
        await renderEngine.buildStaticSite({
            entryFilePath,
            outputDir,
            basePath,
            cwd: workDir,
        });
        console.log(`[build] ${renderEngine.name} build finished: previewId=${previewId}, buildMs=${Date.now() - engineStartedAt}`);

        const {manifest, manifestFilePath: nextManifestFilePath} = await writePreviewManifest({
            previewId,
            buildId,
            basePath,
            outputDir,
            sourceEntry,
        });

        await writePreviewBuildCache({
            version: PREVIEW_BUILD_CACHE_VERSION,
            previewId,
            buildId,
            basePath,
            sourceEntry,
            sourceHash,
            outputDir,
            manifestFilePath: nextManifestFilePath,
            createdAt: manifest.createdAt,
        });

        return {
            buildId,
            previewId,
            basePath,
            sourceEntry,
            sourceHash,
            previewPath: basePath,
            outputDir,
            manifest,
            manifestFilePath: nextManifestFilePath,
            cacheHit: false,
        };
    } finally {
        await rm(workDir, {recursive: true, force: true}).catch(() => {
        });
    }
}
