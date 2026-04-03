import {normalize} from "node:path";

const PREVIEW_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export function sanitizeRelativePath(relativePath) {
    const normalizedPath = normalize(relativePath)
        .replace(/^(\.\.(\/|\\|$))+/, "")
        .replace(/^[/\\]+/, "");
    if (!normalizedPath || normalizedPath.startsWith("..")) {
        throw new Error(`Invalid asset path: ${relativePath}`);
    }
    return normalizedPath;
}

export function normalizeBasePath(basePath, {fallback = null} = {}) {
    const trimmed = basePath?.trim();
    const resolvedPath = trimmed || fallback;
    if (!resolvedPath) {
        throw new Error("Preview basePath is required.");
    }
    if (resolvedPath === ".") {
        return "/";
    }
    const normalizedPath = resolvedPath.replace(/^\/+|\/+$/g, "");
    return normalizedPath ? `/${normalizedPath}/` : "/";
}

export function sanitizePreviewId(previewId) {
    const normalizedId = previewId?.trim();
    if (!normalizedId || !PREVIEW_ID_PATTERN.test(normalizedId)) {
        throw new Error("Invalid previewId. Only letters, numbers, dot, underscore, and dash are allowed.");
    }
    return normalizedId;
}

export function normalizePreviewBasePath(previewId, basePath) {
    const normalizedBasePath = normalizeBasePath(basePath || `/p/${previewId}/`);
    const expectedBasePath = `/p/${previewId}/`;
    if (normalizedBasePath !== expectedBasePath) {
        throw new Error(`Preview basePath must match ${expectedBasePath}`);
    }
    return normalizedBasePath;
}

export function isPathInside(rootDir, targetPath) {
    if (!rootDir || !targetPath) {
        return false;
    }

    const normalizedRoot = rootDir.replace(/[\\/]+$/, "").toLowerCase();
    const normalizedTarget = targetPath.toLowerCase();
    return normalizedTarget === normalizedRoot || normalizedTarget.startsWith(`${normalizedRoot}\\`) || normalizedTarget.startsWith(`${normalizedRoot}/`);
}
