import {mkdir, rm} from "node:fs/promises";
import {join} from "node:path";
import {resolveSourceMode} from "../config/index.mjs";
import {getRenderEngine} from "../engines/index.mjs";
import {writePreviewManifest, writeSourceFiles} from "./artifact-store.mjs";
import {createLocalProjectInput} from "./local-project.mjs";
import {
    MARKOS_SOURCE_MODES,
    buildDeckMarkdown,
    buildRenderOutputMetadata,
    createInlineSourceFiles,
    createPreviewSourceHash,
    createRenderArtifactSourceHash,
    ensureSourceEntryExists,
} from "./source-pipeline.mjs";

export {
    MARKOS_SOURCE_MODES,
    buildDeckMarkdown,
    buildRenderOutputMetadata,
    createInlineSourceFiles,
    createLocalProjectInput,
    createPreviewSourceHash,
    createRenderArtifactSourceHash,
    ensureSourceEntryExists,
    resolveSourceMode,
};

function uniqueDirs(dirs) {
    return [...new Set(dirs.filter(Boolean))];
}

async function recreateDirs(...dirs) {
    for (const dir of uniqueDirs(dirs)) {
        await rm(dir, {recursive: true, force: true}).catch(() => {
        });
        await mkdir(dir, {recursive: true});
    }
}

export function normalizeBuildSource(input, {
    mode = MARKOS_SOURCE_MODES.HOSTED,
} = {}) {
    const sourceFiles = createInlineSourceFiles(input, {mode: resolveSourceMode(mode)});
    const sourceEntry = ensureSourceEntryExists(sourceFiles, input.entry || "slides.md");
    return {
        sourceFiles,
        sourceEntry,
    };
}

export async function buildStaticSiteFromInput({
    input,
    mode = MARKOS_SOURCE_MODES.HOSTED,
    ...options
}) {
    const source = normalizeBuildSource(input, {mode});
    return buildStaticSiteFromSourceFiles({
        ...options,
        ...source,
    });
}

export async function buildStaticSiteFromSourceFiles({
    sourceFiles,
    sourceEntry = "slides.md",
    outputDir,
    workDir,
    basePath,
    renderEngine = getRenderEngine(),
    manifest = null,
}) {
    if (!outputDir) {
        throw new Error("outputDir is required.");
    }
    if (!workDir) {
        throw new Error("workDir is required.");
    }
    if (!basePath) {
        throw new Error("basePath is required.");
    }

    const normalizedSourceEntry = ensureSourceEntryExists(sourceFiles, sourceEntry);
    const entryFilePath = join(workDir, normalizedSourceEntry);

    await recreateDirs(workDir, outputDir);
    await writeSourceFiles(workDir, sourceFiles);
    await renderEngine.buildStaticSite({
        entryFilePath,
        outputDir,
        basePath,
        cwd: workDir,
    });

    let manifestResult = null;
    if (manifest) {
        manifestResult = await writePreviewManifest({
            previewId: manifest.previewId,
            buildId: manifest.buildId,
            basePath,
            outputDir,
            sourceEntry: normalizedSourceEntry,
        });
    }

    return {
        sourceEntry: normalizedSourceEntry,
        entryFilePath,
        outputDir,
        basePath,
        manifest: manifestResult?.manifest ?? null,
        manifestFilePath: manifestResult?.manifestFilePath ?? null,
    };
}

export async function buildArtifactFromInput({
    input,
    mode = MARKOS_SOURCE_MODES.HOSTED,
    outputFileName = buildRenderOutputMetadata(input).outputFileName,
    ...options
}) {
    const source = normalizeBuildSource(input, {mode});
    return buildArtifactFromSourceFiles({
        ...options,
        ...source,
        outputFileName,
    });
}

export async function buildArtifactFromSourceFiles({
    sourceFiles,
    sourceEntry = "slides.md",
    artifactDir,
    workDir,
    format,
    outputFileName,
    webBasePath,
    renderEngine = getRenderEngine(),
}) {
    if (!artifactDir) {
        throw new Error("artifactDir is required.");
    }
    if (!workDir) {
        throw new Error("workDir is required.");
    }
    if (!format) {
        throw new Error("format is required.");
    }

    const normalizedSourceEntry = ensureSourceEntryExists(sourceFiles, sourceEntry);
    const entryFilePath = join(workDir, normalizedSourceEntry);

    await recreateDirs(workDir, artifactDir);
    await writeSourceFiles(workDir, sourceFiles);

    if (format === "web") {
        if (!webBasePath) {
            throw new Error("webBasePath is required when building a web artifact.");
        }

        const outputDir = join(artifactDir, "web");
        await mkdir(outputDir, {recursive: true});
        await renderEngine.buildStaticSite({
            entryFilePath,
            outputDir,
            basePath: webBasePath,
            cwd: workDir,
        });

        return {
            sourceEntry: normalizedSourceEntry,
            entryFilePath,
            outputDir,
            artifactFilePath: null,
            fileName: outputFileName,
            format,
        };
    }

    if (!outputFileName) {
        throw new Error("outputFileName is required when building a file artifact.");
    }

    const artifactFilePath = join(artifactDir, outputFileName);
    await renderEngine.exportArtifact({
        entryFilePath,
        format,
        outputFilePath: artifactFilePath,
        cwd: workDir,
    });

    return {
        sourceEntry: normalizedSourceEntry,
        entryFilePath,
        outputDir: null,
        artifactFilePath,
        fileName: outputFileName,
        format,
    };
}
