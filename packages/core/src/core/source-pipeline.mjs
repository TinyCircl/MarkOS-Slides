import {createHash} from "node:crypto";
import {relative} from "node:path";
import {sanitizeRelativePath} from "./path-utils.mjs";

const RE_MONACO_CODE_FENCE = /^(```[^\n]*?)\s*\{monaco(?:-run|-diff)?\}([^\n]*)$/gm;
const RE_MONACO_SNIPPET = /^(\s*<<<[^\n]*?)\{monaco-write\}([^\n]*)$/gm;
const RE_MARKDOWN_IMAGE = /!\[([^\]]*)]\(([^)]+)\)/g;
const RE_SNIPPET_IMPORT = /^(\s*<<<\s+)(\S+)(.*)$/gm;
const RE_HTML_COMMENT = /<!--[\s\S]*?-->/g;
const RE_BR_TAG = /<br\s*\/?>/gi;
const RE_IMG_TAG = /<img\b[^>]*>/gi;
const RE_RESOURCE_BLOCK = /<(video|audio|iframe|embed)\b[^>]*>[\s\S]*?<\/\1>/gi;
const RE_RESOURCE_TAG = /<(video|audio|source|iframe|embed)\b[^>]*>/gi;
const RE_RESOURCE_CLOSE_TAG = /<\/(video|audio|source|iframe|embed)>/gi;
const RE_OBJECT_BLOCK = /<object\b[^>]*>[\s\S]*?<\/object>/gi;
const RE_OBJECT_TAG = /<object\b[^>]*>/gi;
const RE_OBJECT_CLOSE_TAG = /<\/object>/gi;
const RE_SELF_CLOSING_CUSTOM_TAG = /<([A-Z][\w]*|[a-z][\w]*(?:-[\w-]+)+)\b[^>]*\/>/g;
const RE_CUSTOM_OPEN_CLOSE_TAG = /<\/?([A-Z][\w]*|[a-z][\w]*(?:-[\w-]+)+)\b[^>]*>/g;
const RE_CODE_FENCE_MARKER = /^(\s*)(`{3,}|~{3,})/;
export const MARKOS_SOURCE_MODES = Object.freeze({
    HOSTED: "hosted",
    AUTHORING: "authoring",
});

function normalizeText(value) {
    return value.replace(/\r\n?/g, "\n");
}

function normalizeTitle(title) {
    const trimmed = title?.trim();
    return trimmed && trimmed.length > 0 ? trimmed : "Untitled Slides";
}

function normalizeSourceMode(mode) {
    return mode === MARKOS_SOURCE_MODES.AUTHORING
        ? MARKOS_SOURCE_MODES.AUTHORING
        : MARKOS_SOURCE_MODES.HOSTED;
}

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function upsertTopLevelKey(frontmatter, key, value) {
    const lines = frontmatter.split("\n");
    const keyPattern = new RegExp(`^${escapeRegExp(key)}\\s*:`);
    const filtered = lines.filter((line) => !keyPattern.test(line));
    filtered.push(`${key}: ${JSON.stringify(value)}`);
    return filtered.join("\n").trim();
}

function joinMarkdownLine(prefix, suffix = "") {
    const normalizedPrefix = prefix.replace(/\s+$/g, "");
    const normalizedSuffix = suffix.trim();
    return normalizedSuffix
        ? `${normalizedPrefix} ${normalizedSuffix}`
        : normalizedPrefix;
}

function extractHtmlAttribute(tag, name) {
    const quoted = tag.match(new RegExp(`\\b${name}\\s*=\\s*(['"])(.*?)\\1`, "i"));
    if (quoted?.[2]) {
        return quoted[2];
    }

    const bare = tag.match(new RegExp(`\\b${name}\\s*=\\s*([^\\s>]+)`, "i"));
    return bare?.[1] ?? "";
}

function extractImgAltText(tag) {
    return extractHtmlAttribute(tag, "alt");
}

function isPathReference(value) {
    const trimmed = value?.trim();
    if (!trimmed) {
        return false;
    }

    if (/^(https?:|mailto:|tel:|data:|blob:|#|\/\/)/i.test(trimmed)) {
        return false;
    }

    return true;
}

function stripResourcePathReferences(chunk) {
    return chunk
        .replace(RE_MARKDOWN_IMAGE, (_full, alt = "", target = "") => isPathReference(target) ? alt.trim() : _full)
        .replace(RE_SNIPPET_IMPORT, (_full, prefix = "", target = "", suffix = "") => isPathReference(target) ? "" : joinMarkdownLine(`${prefix}${target}`, suffix))
        .replace(RE_HTML_COMMENT, "")
        .replace(RE_BR_TAG, "\n")
        .replace(RE_RESOURCE_BLOCK, (tag) => {
            const src = extractHtmlAttribute(tag, "src");
            return isPathReference(src) ? "" : tag;
        })
        .replace(RE_OBJECT_BLOCK, (tag) => {
            const data = extractHtmlAttribute(tag, "data");
            return isPathReference(data) ? "" : tag;
        })
        .replace(RE_IMG_TAG, (tag) => {
            const src = extractHtmlAttribute(tag, "src");
            return isPathReference(src) ? extractImgAltText(tag) : tag;
        })
        .replace(RE_RESOURCE_TAG, (tag) => {
            const src = extractHtmlAttribute(tag, "src");
            return isPathReference(src) ? "" : tag;
        })
        .replace(RE_OBJECT_TAG, (tag) => {
            const data = extractHtmlAttribute(tag, "data");
            return isPathReference(data) ? "" : tag;
        })
        .replace(RE_RESOURCE_CLOSE_TAG, "")
        .replace(RE_OBJECT_CLOSE_TAG, "")
        .replace(RE_SELF_CLOSING_CUSTOM_TAG, "")
        .replace(RE_CUSTOM_OPEN_CLOSE_TAG, "")
        .split("\n")
        .map((line) => {
            const trimmed = line.trim();
            if (/^<\/?[A-Za-z][^>\n]*$/.test(trimmed)) {
                return "";
            }
            return line;
        })
        .join("\n")
        .replace(/\n{3,}/g, "\n\n");
}

function transformMarkdownOutsideCodeFences(markdown, transform) {
    const lines = markdown.split("\n");
    const output = [];
    let buffer = [];
    let activeFence = null;

    function flushBuffer() {
        if (!buffer.length) {
            return;
        }
        output.push(...transform(buffer.join("\n")).split("\n"));
        buffer = [];
    }

    for (const line of lines) {
        const fenceMatch = line.match(RE_CODE_FENCE_MARKER);
        if (!activeFence) {
            if (fenceMatch) {
                flushBuffer();
                activeFence = {
                    char: fenceMatch[2][0],
                    size: fenceMatch[2].length,
                };
                output.push(line);
                continue;
            }
            buffer.push(line);
            continue;
        }

        output.push(line);
        if (fenceMatch && fenceMatch[2][0] === activeFence.char && fenceMatch[2].length >= activeFence.size) {
            activeFence = null;
        }
    }

    flushBuffer();
    return output.join("\n");
}

function sanitizeHostedRendererMarkdownSyntax(markdown) {
    const withoutHeavyFeatures = markdown
        .replace(RE_MONACO_CODE_FENCE, (_full, prefix = "", suffix = "") => joinMarkdownLine(prefix, suffix))
        .replace(RE_MONACO_SNIPPET, (_full, prefix = "", suffix = "") => joinMarkdownLine(prefix, suffix));

    return transformMarkdownOutsideCodeFences(withoutHeavyFeatures, stripResourcePathReferences);
}

function enforceServiceFrontmatterOnMarkdown(markdown, {
    title,
    sanitizeMarkdown = true,
} = {}) {
    const normalizedMarkdown = normalizeText(markdown);
    const trimmed = normalizedMarkdown.trim();

    if (!trimmed) {
        const frontmatterLines = [];
        if (title) {
            frontmatterLines.push(`title: ${JSON.stringify(title)}`);
        }
        const enforced = frontmatterLines.join("\n");
        return `---\n${enforced}\n---\n`;
    }

    if (trimmed.startsWith("---")) {
        const match = normalizedMarkdown.match(/^---\r?\n([\s\S]*?)\r?\n---/);
        if (match) {
            let enforced = match[1].trim();
            if (title && !/^title\s*:/m.test(match[1])) {
                enforced = upsertTopLevelKey(enforced, "title", title);
            }
            const withForcedFrontmatter = normalizedMarkdown.replace(match[1], enforced).replace(/\s*$/, "\n");
            return sanitizeMarkdown
                ? sanitizeHostedRendererMarkdownSyntax(withForcedFrontmatter)
                : withForcedFrontmatter;
        }
    }

    const frontmatterLines = [];
    if (title) {
        frontmatterLines.push(`title: ${JSON.stringify(title)}`);
    }

    const enforced = frontmatterLines.join("\n");
    const withFrontmatter = `---\n${enforced}\n---\n\n${trimmed}\n`;
    return sanitizeMarkdown
        ? sanitizeHostedRendererMarkdownSyntax(withFrontmatter)
        : withFrontmatter;
}

function hasInlineSourceFiles(input) {
    return Array.isArray(input?.source?.files) && input.source.files.length > 0;
}

function normalizeSourceFilesForHash(files) {
    return files
        .map((file) => ({
            path: sanitizeRelativePath(file.path),
            content: typeof file.content === "string" ? file.content : null,
            contentBase64: typeof file.contentBase64 === "string" ? file.contentBase64 : null,
        }))
        .sort((left, right) => left.path.localeCompare(right.path));
}

export function buildDeckMarkdown(input, {
    sanitizeMarkdown,
    mode = MARKOS_SOURCE_MODES.HOSTED,
} = {}) {
    const resolvedMode = normalizeSourceMode(mode);
    const shouldSanitizeMarkdown = typeof sanitizeMarkdown === "boolean"
        ? sanitizeMarkdown
        : resolvedMode === MARKOS_SOURCE_MODES.HOSTED;
    const title = normalizeTitle(input.title);
    const content = normalizeText(input.content).trim();

    if (!content) {
        return `${enforceServiceFrontmatterOnMarkdown("", {
            title,
            sanitizeMarkdown: shouldSanitizeMarkdown,
        })}\n# ${title}\n\nStart writing to generate slides.\n`;
    }

    return enforceServiceFrontmatterOnMarkdown(content, {
        title,
        sanitizeMarkdown: shouldSanitizeMarkdown,
    });
}

export function createInlineSourceFiles(input, {
    mode = MARKOS_SOURCE_MODES.HOSTED,
} = {}) {
    const sourceEntry = sanitizeRelativePath(input.entry || "slides.md");
    const files = [];

    if (hasInlineSourceFiles(input)) {
        for (const file of input.source.files) {
            const relativePath = sanitizeRelativePath(file.path);
            if (typeof file.content === "string") {
                files.push({
                    path: relativePath,
                    content: relativePath === sourceEntry
                        ? buildDeckMarkdown({
                            title: input.title,
                            content: file.content,
                        }, {
                            sanitizeMarkdown: false,
                        })
                        : file.content,
                });
                continue;
            }

            files.push({
                path: relativePath,
                contentBase64: file.contentBase64,
            });
        }
    } else {
        files.push({
            path: sourceEntry,
            content: buildDeckMarkdown(input, {mode}),
        });
    }

    for (const asset of input.assets ?? []) {
        files.push({
            path: sanitizeRelativePath(asset.path),
            contentBase64: asset.contentBase64,
        });
    }

    return files;
}

export function ensureSourceEntryExists(files, sourceEntry) {
    const normalizedEntry = sanitizeRelativePath(sourceEntry);
    if (!files.some((file) => sanitizeRelativePath(file.path) === normalizedEntry)) {
        throw new Error(`Source entry file not found: ${normalizedEntry}`);
    }
    return normalizedEntry;
}

export function createPreviewSourceHash({version, basePath, sourceEntry, sourceFiles}) {
    return createHash("sha256")
        .update(JSON.stringify({
            version,
            basePath,
            sourceEntry,
            sourceFiles: normalizeSourceFilesForHash(sourceFiles),
        }))
        .digest("hex");
}

export function buildRenderOutputMetadata(input) {
    if (input.format === "web") {
        return {
            baseName: "index",
            outputFileName: "index.html",
        };
    }

    const extension = input.format;
    const baseName = (input.fileName?.trim() || normalizeTitle(input.title)).replace(/[<>:"/\\|?*\x00-\x1F]/g, "_");
    return {
        baseName,
        outputFileName: `${baseName}.${extension}`,
    };
}

export function createRenderArtifactSourceHash({version, format, outputFileName, sourceEntry, sourceFiles}) {
    return createHash("sha256")
        .update(JSON.stringify({
            version,
            format,
            outputFileName,
            sourceEntry,
            sourceFiles: normalizeSourceFilesForHash(sourceFiles),
        }))
        .digest("hex");
}
