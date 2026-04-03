import {readFile, stat} from "node:fs/promises";
import {extname, join} from "node:path";

const MIME_TYPES = new Map([
    [".css", "text/css; charset=utf-8"],
    [".gif", "image/gif"],
    [".html", "text/html; charset=utf-8"],
    [".ico", "image/x-icon"],
    [".jpeg", "image/jpeg"],
    [".jpg", "image/jpeg"],
    [".js", "text/javascript; charset=utf-8"],
    [".json", "application/json; charset=utf-8"],
    [".md", "text/markdown; charset=utf-8"],
    [".png", "image/png"],
    [".svg", "image/svg+xml"],
    [".txt", "text/plain; charset=utf-8"],
    [".webp", "image/webp"],
    [".woff", "font/woff"],
    [".woff2", "font/woff2"],
]);

async function isFile(filePath) {
    try {
        const fileStat = await stat(filePath);
        return fileStat.isFile();
    } catch {
        return false;
    }
}

export function sanitizeSiteObjectPath(objectPath) {
    const normalizedPath = String(objectPath || "")
        .replace(/\\/g, "/")
        .replace(/^\/+/, "")
        .replace(/^(\.\.\/)+/, "");

    if (!normalizedPath || normalizedPath.startsWith("..")) {
        return null;
    }

    return normalizedPath;
}

export function getFileContentType(filePath, fallbackType = "application/octet-stream") {
    return MIME_TYPES.get(extname(filePath).toLowerCase()) || fallbackType;
}

export async function readSiteManifest(rootDir) {
    try {
        return JSON.parse(await readFile(join(rootDir, "manifest.json"), "utf8"));
    } catch {
        return null;
    }
}

export async function resolveManifestSiteRequest({
    rootDir,
    basePrefix,
    requestPathname,
}) {
    if (requestPathname === basePrefix.slice(0, -1)) {
        return {
            type: "redirect",
            status: 301,
            location: basePrefix,
        };
    }

    const manifest = await readSiteManifest(rootDir);
    if (!manifest) {
        return {
            type: "error",
            status: 404,
            reason: "missing_manifest",
        };
    }

    const subPath = requestPathname.startsWith(basePrefix)
        ? requestPathname.slice(basePrefix.length)
        : "";
    const entry = typeof manifest.entry === "string" && manifest.entry ? manifest.entry : "index.html";
    const spaFallback = manifest.spaFallback === true;
    const assetPrefixes = Array.isArray(manifest.assetPrefixes) ? manifest.assetPrefixes : [];
    const privateFiles = Array.isArray(manifest.privateFiles) ? manifest.privateFiles : [];
    const objectPath = subPath || entry;

    if (privateFiles.includes(objectPath)) {
        return {
            type: "error",
            status: 403,
            reason: "forbidden",
        };
    }

    const safeObjectPath = sanitizeSiteObjectPath(objectPath);
    if (!safeObjectPath) {
        return {
            type: "error",
            status: 400,
            reason: "invalid_path",
        };
    }

    const absoluteFilePath = join(rootDir, safeObjectPath);
    if (await isFile(absoluteFilePath)) {
        return {
            type: "file",
            status: 200,
            relativePath: safeObjectPath,
            absoluteFilePath,
            contentType: getFileContentType(safeObjectPath),
        };
    }

    const isAssetPath = assetPrefixes.some((prefix) => objectPath.startsWith(prefix));
    if (isAssetPath) {
        return {
            type: "error",
            status: 404,
            reason: "asset_not_found",
        };
    }

    if (!spaFallback) {
        return {
            type: "error",
            status: 404,
            reason: "not_found",
        };
    }

    const fallbackRelativePath = sanitizeSiteObjectPath(entry);
    if (!fallbackRelativePath) {
        return {
            type: "error",
            status: 500,
            reason: "invalid_entry",
        };
    }

    const fallbackAbsolutePath = join(rootDir, fallbackRelativePath);
    if (!await isFile(fallbackAbsolutePath)) {
        return {
            type: "error",
            status: 404,
            reason: "entry_missing",
        };
    }

    return {
        type: "file",
        status: 200,
        relativePath: fallbackRelativePath,
        absoluteFilePath: fallbackAbsolutePath,
        contentType: "text/html; charset=utf-8",
    };
}
