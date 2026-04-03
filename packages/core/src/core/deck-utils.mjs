import {stat} from "node:fs/promises";
import {basename, dirname, extname, join, resolve} from "node:path";
import {parseDocument} from "yaml";

export const FILE_FRONTMATTER_KEYS = new Set([
    "theme",
    "title",
    "aspectRatio",
    "canvasWidth",
]);

export const MARKOS_THEME_WORK_DIRNAME = ".markos-theme";
export const MARKOS_OVERRIDES_CSS_NAME = "overrides.css";

export function normalizeText(value) {
    return String(value).replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
}

export function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function upsertTopLevelKey(frontmatter, key, value) {
    const lines = frontmatter.split("\n");
    const keyPattern = new RegExp(`^${escapeRegExp(key)}\\s*:`);
    const filtered = lines.filter((line) => !keyPattern.test(line));
    filtered.push(`${key}: ${JSON.stringify(value)}`);
    return filtered.join("\n").trim();
}

export function getSiblingCssPath(entryFilePath) {
    return join(
        dirname(entryFilePath),
        `${basename(entryFilePath, extname(entryFilePath))}.css`,
    );
}

export function getOverridesCssPath(entryFilePath) {
    return join(dirname(entryFilePath), MARKOS_OVERRIDES_CSS_NAME);
}

export function getDeckCssFilePaths(entryFilePath) {
    return [
        getSiblingCssPath(entryFilePath),
        getOverridesCssPath(entryFilePath),
    ];
}

export function isPathWithin(parentPath, targetPath) {
    const normalizedParent = resolve(parentPath);
    const normalizedTarget = resolve(targetPath);
    return normalizedTarget === normalizedParent
        || normalizedTarget.startsWith(`${normalizedParent}\\`)
        || normalizedTarget.startsWith(`${normalizedParent}/`);
}

export async function getPathKind(targetPath) {
    try {
        const targetStat = await stat(targetPath);
        if (targetStat.isDirectory()) {
            return "directory";
        }
        if (targetStat.isFile()) {
            return "file";
        }
        return "other";
    } catch {
        return null;
    }
}

export async function pathExists(targetPath) {
    return (await getPathKind(targetPath)) !== null;
}

export function parseYamlObject(raw, {fallback = {}} = {}) {
    if (!String(raw ?? "").trim()) {
        return fallback;
    }

    try {
        const parsed = parseDocument(raw).toJS({});
        return parsed && typeof parsed === "object" ? parsed : fallback;
    } catch {
        return fallback;
    }
}
