import {readFile} from "node:fs/promises";
import {basename, dirname, extname, relative, resolve} from "node:path";
import {getDeckCssFilePaths, isPathWithin, pathExists} from "./deck-utils.mjs";

function toPosixPath(filePath) {
    return filePath.replace(/\\/g, "/");
}

function normalizeIgnoredPaths(paths = []) {
    return paths
        .filter(Boolean)
        .map((targetPath) => resolve(targetPath));
}

function shouldIgnorePath(targetPath, ignoredPaths) {
    return ignoredPaths.some((ignoredPath) => isPathWithin(ignoredPath, targetPath));
}

export async function createLocalProjectInput({
    entryFilePath,
    projectRoot = dirname(entryFilePath),
    title,
    ignoredPaths = [],
} = {}) {
    if (!entryFilePath) {
        throw new Error("entryFilePath is required.");
    }

    const resolvedEntryFilePath = resolve(entryFilePath);
    const resolvedProjectRoot = resolve(projectRoot);
    const normalizedIgnoredPaths = normalizeIgnoredPaths(ignoredPaths);

    if (!await pathExists(resolvedEntryFilePath)) {
        throw new Error(`Entry file not found: ${resolvedEntryFilePath}`);
    }
    if (!await pathExists(resolvedProjectRoot)) {
        throw new Error(`Project root not found: ${resolvedProjectRoot}`);
    }
    if (!isPathWithin(resolvedProjectRoot, resolvedEntryFilePath)) {
        throw new Error(`Entry file must be inside project root: ${resolvedEntryFilePath}`);
    }
    if (shouldIgnorePath(resolvedEntryFilePath, normalizedIgnoredPaths)) {
        throw new Error(`Entry file is excluded by ignored paths: ${resolvedEntryFilePath}`);
    }

    const relativeEntryPath = toPosixPath(relative(resolvedProjectRoot, resolvedEntryFilePath));
    const sourceFiles = [
        {
            path: relativeEntryPath,
            content: await readFile(resolvedEntryFilePath, "utf8"),
        },
    ];

    for (const cssPath of getDeckCssFilePaths(resolvedEntryFilePath)) {
        if (
            !await pathExists(cssPath)
            || !isPathWithin(resolvedProjectRoot, cssPath)
            || shouldIgnorePath(cssPath, normalizedIgnoredPaths)
        ) {
            continue;
        }

        sourceFiles.push({
            path: toPosixPath(relative(resolvedProjectRoot, cssPath)),
            content: await readFile(cssPath, "utf8"),
        });
    }

    return {
        title: title?.trim() || basename(resolvedEntryFilePath, extname(resolvedEntryFilePath)),
        entry: relativeEntryPath,
        source: {
            files: sourceFiles,
        },
    };
}
