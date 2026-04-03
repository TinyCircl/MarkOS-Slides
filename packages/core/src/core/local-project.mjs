import {readFile, readdir, stat} from "node:fs/promises";
import {basename, dirname, extname, relative, resolve} from "node:path";

const DEFAULT_IGNORED_DIRS = new Set([
    ".git",
    ".markos",
    ".markos-artifacts",
    ".markos-preview",
    ".markos-preview-work",
    ".markos-work",
    ".markos-workspaces",
    "node_modules",
]);

const TEXT_FILE_EXTENSIONS = new Set([
    ".css",
    ".csv",
    ".html",
    ".js",
    ".json",
    ".jsx",
    ".md",
    ".markdown",
    ".mdx",
    ".mjs",
    ".svg",
    ".ts",
    ".tsx",
    ".txt",
    ".vue",
    ".xml",
    ".yaml",
    ".yml",
]);

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

function isTextFile(filePath) {
    return TEXT_FILE_EXTENSIONS.has(extname(filePath).toLowerCase());
}

async function pathExists(targetPath) {
    try {
        await stat(targetPath);
        return true;
    } catch {
        return false;
    }
}

async function listProjectFiles(rootDir, {
    ignoredDirs = DEFAULT_IGNORED_DIRS,
    ignoredPaths = [],
} = {}, currentDir = rootDir) {
    const entries = await readdir(currentDir, {withFileTypes: true});
    const files = [];

    for (const entry of entries) {
        const absolutePath = resolve(currentDir, entry.name);
        if (shouldIgnorePath(absolutePath, ignoredPaths)) {
            continue;
        }

        if (entry.isDirectory()) {
            if (ignoredDirs.has(entry.name)) {
                continue;
            }
            files.push(...await listProjectFiles(rootDir, {
                ignoredDirs,
                ignoredPaths,
            }, absolutePath));
            continue;
        }

        if (!entry.isFile()) {
            continue;
        }

        files.push(absolutePath);
    }

    return files.sort((left, right) => left.localeCompare(right));
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

    const absoluteFiles = await listProjectFiles(resolvedProjectRoot, {
        ignoredPaths: normalizedIgnoredPaths,
    });
    const relativeEntryPath = toPosixPath(relative(resolvedProjectRoot, resolvedEntryFilePath));

    if (!absoluteFiles.includes(resolvedEntryFilePath)) {
        throw new Error(`Entry file is excluded by ignored paths: ${resolvedEntryFilePath}`);
    }

    const sourceFiles = [];
    for (const absolutePath of absoluteFiles) {
        const relativePath = toPosixPath(relative(resolvedProjectRoot, absolutePath));
        const buffer = await readFile(absolutePath);

        if (absolutePath === resolvedEntryFilePath || isTextFile(absolutePath)) {
            sourceFiles.push({
                path: relativePath,
                content: buffer.toString("utf8"),
            });
            continue;
        }

        sourceFiles.push({
            path: relativePath,
            contentBase64: buffer.toString("base64"),
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
