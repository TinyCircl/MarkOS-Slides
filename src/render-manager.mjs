import {randomUUID} from "node:crypto";
import {rm} from "node:fs/promises";
import {join} from "node:path";
import {
    buildArtifactFromSourceFiles,
    buildDeckMarkdown,
    buildRenderOutputMetadata,
    buildStaticSiteFromSourceFiles,
    createInlineSourceFiles,
    createPreviewSourceHash,
    createRenderArtifactSourceHash,
    normalizeBuildSource,
} from "./core/index.mjs";
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
    writeRenderBuildCache,
} from "./core/artifact-store.mjs";
import {normalizePreviewBasePath, sanitizePreviewId} from "./core/path-utils.mjs";

const PREVIEW_BUILD_CACHE_VERSION = 2;
const RENDER_BUILD_CACHE_VERSION = 2;

export {
    buildDeckMarkdown,
    createInlineSourceFiles,
    normalizeBuildSource,
    cleanupExpiredLocalArtifacts,
    getCachedPreviewPublishResult,
    getCachedRenderPublishResult,
    startArtifactCleanupScheduler,
    updateCachedPreviewPublishResult,
    updateCachedRenderPublishResult,
};

export async function renderArtifact(input) {
    const {outputFileName} = buildRenderOutputMetadata(input);
    const {sourceFiles, sourceEntry} = normalizeBuildSource(input);
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
    const cacheFilePath = getRenderBuildCacheFilePath(cacheKey);
    const artifactPath = input.format === "web"
        ? `/artifacts/${jobId}/web/`
        : `/artifacts/${jobId}/${outputFileName}`;

    try {
        const builtArtifact = await buildArtifactFromSourceFiles({
            sourceFiles,
            sourceEntry,
            artifactDir,
            workDir,
            format: input.format,
            outputFileName,
            webBasePath: input.format === "web" ? artifactPath : null,
        });

        await writeRenderBuildCache({
            version: RENDER_BUILD_CACHE_VERSION,
            cacheKey,
            jobId,
            format: builtArtifact.format,
            outputFileName,
            artifactPath,
            artifactDir,
            artifactFilePath: builtArtifact.artifactFilePath,
            outputDir: builtArtifact.outputDir,
            sourceHash,
            createdAt: new Date().toISOString(),
        });

        scheduleRenderArtifactCleanup(jobId, {cacheFilePath});
        return {
            jobId,
            format: builtArtifact.format,
            artifactPath,
            fileName: builtArtifact.fileName,
            artifactDir,
            artifactFilePath: builtArtifact.artifactFilePath,
            outputDir: builtArtifact.outputDir,
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
    const previewId = sanitizePreviewId(input.previewId);
    const basePath = normalizePreviewBasePath(previewId, input.basePath);
    const {sourceFiles, sourceEntry} = normalizeBuildSource(input);
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

    try {
        const engineStartedAt = Date.now();
        const builtPreview = await buildStaticSiteFromSourceFiles({
            sourceFiles,
            sourceEntry,
            outputDir,
            workDir,
            basePath,
            manifest: {
                previewId,
                buildId,
            },
        });
        console.log(`[build] buildStaticSite finished: previewId=${previewId}, buildMs=${Date.now() - engineStartedAt}`);

        await writePreviewBuildCache({
            version: PREVIEW_BUILD_CACHE_VERSION,
            previewId,
            buildId,
            basePath,
            sourceEntry,
            sourceHash,
            outputDir,
            manifestFilePath: builtPreview.manifestFilePath,
            createdAt: builtPreview.manifest.createdAt,
        });

        return {
            buildId,
            previewId,
            basePath,
            sourceEntry,
            sourceHash,
            previewPath: basePath,
            outputDir,
            manifest: builtPreview.manifest,
            manifestFilePath: builtPreview.manifestFilePath,
            cacheHit: false,
        };
    } finally {
        await rm(workDir, {recursive: true, force: true}).catch(() => {
        });
    }
}
