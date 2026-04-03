import {readFile, stat} from "node:fs/promises";
import {basename, dirname, extname, join, relative, resolve} from "node:path";

function toPosixPath(filePath) {
    return filePath.replace(/\\/g, "/");
}

function normalizeIgnoredPaths(paths = []) {
    return paths
        .filter(Boolean)
        .map((targetPath) => resolve(targetPath));
}

function isPathWithin(parentPath, targetPath) {
    return targetPath === parentPath || targetPath.startsWith(`${parentPath}/`) || targetPath.startsWith(`${parentPath}\\`);
}

function shouldIgnorePath(targetPath, ignoredPaths) {
    return ignoredPaths.some((ignoredPath) => isPathWithin(ignoredPath, targetPath));
}

async function pathExists(targetPath) {
    try {
        await stat(targetPath);
        return true;
    } catch {
        return false;
    }
}

function getSiblingCssPath(entryFilePath) {
    return join(
        dirname(entryFilePath),
        `${basename(entryFilePath, extname(entryFilePath))}.css`,
    );
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

    const siblingCssPath = getSiblingCssPath(resolvedEntryFilePath);
    if (
        await pathExists(siblingCssPath)
        && isPathWithin(resolvedProjectRoot, siblingCssPath)
        && !shouldIgnorePath(siblingCssPath, normalizedIgnoredPaths)
    ) {
        sourceFiles.push({
            path: toPosixPath(relative(resolvedProjectRoot, siblingCssPath)),
            content: await readFile(siblingCssPath, "utf8"),
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
