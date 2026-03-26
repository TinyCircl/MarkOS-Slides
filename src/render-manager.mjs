import {createHash, randomUUID} from "node:crypto";
import {spawn} from "node:child_process";
import {mkdir, readFile, readdir, rm, stat, writeFile} from "node:fs/promises";
import {dirname, join, normalize, resolve} from "node:path";

const LOCAL_ARTIFACT_RETENTION_MS = Number(process.env.SLIDEV_LOCAL_ARTIFACT_RETENTION_MS || 7 * 24 * 60 * 60 * 1000);
const LOCAL_ARTIFACT_CLEANUP_INTERVAL_MS = Number(process.env.SLIDEV_LOCAL_ARTIFACT_CLEANUP_INTERVAL_MS || 60 * 60 * 1000);
const EXPORT_TIMEOUT_MS = Number(process.env.SLIDEV_EXPORT_TIMEOUT_MS || 30000);
// Preview artifacts are persisted across deploys, so semantic renderer changes
// must invalidate the cache to avoid serving stale builds.
const PREVIEW_BUILD_CACHE_VERSION = 2;
const RENDER_BUILD_CACHE_VERSION = 1;
const SLIDEV_RENDERER_CLI_ARGS = [];
const PREVIEW_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const RENDER_ARTIFACTS_DIRNAME = "renders";
const PREVIEW_ARTIFACTS_DIRNAME = "previews";
const PREVIEW_BUILD_CACHE_DIRNAME = "preview-cache";
const RENDER_BUILD_CACHE_DIRNAME = "render-cache";
const renderArtifactCleanupTimers = new Map();
let artifactCleanupTimer = null;
let artifactCleanupRun = null;

function normalizeText(value) {
    return value.replace(/\r\n?/g, "\n");
}

function normalizeTitle(title) {
    const trimmed = title?.trim();
    return trimmed && trimmed.length > 0 ? trimmed : "Untitled Slides";
}

// Performance-sensitive frontmatter overrides for the hosted renderer.
// Each key supports three states:
// - "true" / "false" (or any other raw YAML scalar/object string): force override
// - "default": do not modify the deck's original value
//
// You can change these defaults here, or override them from `.env` with the
// corresponding `SLIDEV_OVERRIDE_*` variable.
const SERVICE_FRONTMATTER_OVERRIDE_DEFAULTS = {
    // Enable fault-tolerant builds by default so malformed decks can still render a preview.
    faultTolerance: "true",
    // Preview builds should not implicitly generate extra export artifacts unless explicitly requested.
    download: "false",
    // Prevent post-build OG image generation in preview/static-site mode.
    seoMetaOgImage: "false",
    // Monaco and related type loading are expensive and unnecessary for hosted preview rendering.
    monaco: "false",
    presenter: "false",
    drawings: "{enabled: false}",
    wakeLock: "false",
    record: "false",
    browserExporter: "false",
    codeCopy: "false",
    contextMenu: "false",
    preloadImages: "false",
    remoteAssets: "false",
    twoslash: "default",
    addons: "default",
    theme: "default",
    info: "default",
    mdc: "default",
};

// `type: "top-level"` maps to `key: value`
// `type: "nested"` maps to `parentKey.key: value`, while keeping other nested fields intact.
const SERVICE_FRONTMATTER_OVERRIDE_DEFINITIONS = [
    {id: "faultTolerance", env: "SLIDEV_OVERRIDE_FAULT_TOLERANCE", type: "top-level", key: "faultTolerance"},
    {id: "download", env: "SLIDEV_OVERRIDE_DOWNLOAD", type: "top-level", key: "download"},
    {id: "seoMetaOgImage", env: "SLIDEV_OVERRIDE_SEO_META_OG_IMAGE", type: "nested", parentKey: "seoMeta", key: "ogImage"},
    {id: "monaco", env: "SLIDEV_OVERRIDE_MONACO", type: "top-level", key: "monaco"},
    {id: "presenter", env: "SLIDEV_OVERRIDE_PRESENTER", type: "top-level", key: "presenter"},
    {id: "drawings", env: "SLIDEV_OVERRIDE_DRAWINGS", type: "top-level", key: "drawings"},
    {id: "wakeLock", env: "SLIDEV_OVERRIDE_WAKE_LOCK", type: "top-level", key: "wakeLock"},
    {id: "record", env: "SLIDEV_OVERRIDE_RECORD", type: "top-level", key: "record"},
    {id: "browserExporter", env: "SLIDEV_OVERRIDE_BROWSER_EXPORTER", type: "top-level", key: "browserExporter"},
    {id: "codeCopy", env: "SLIDEV_OVERRIDE_CODE_COPY", type: "top-level", key: "codeCopy"},
    {id: "contextMenu", env: "SLIDEV_OVERRIDE_CONTEXT_MENU", type: "top-level", key: "contextMenu"},
    {id: "preloadImages", env: "SLIDEV_OVERRIDE_PRELOAD_IMAGES", type: "top-level", key: "preloadImages"},
    {id: "remoteAssets", env: "SLIDEV_OVERRIDE_REMOTE_ASSETS", type: "top-level", key: "remoteAssets"},
    {id: "twoslash", env: "SLIDEV_OVERRIDE_TWOSLASH", type: "top-level", key: "twoslash"},
    {id: "addons", env: "SLIDEV_OVERRIDE_ADDONS", type: "top-level", key: "addons"},
    {id: "theme", env: "SLIDEV_OVERRIDE_THEME", type: "top-level", key: "theme"},
    {id: "info", env: "SLIDEV_OVERRIDE_INFO", type: "top-level", key: "info"},
    {id: "mdc", env: "SLIDEV_OVERRIDE_MDC", type: "top-level", key: "mdc"},
];

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

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function removeTopLevelFrontmatterKey(frontmatter, key) {
    const lines = frontmatter.split("\n");
    const remaining = [];

    for (let index = 0; index < lines.length; index++) {
        const line = lines[index];
        const match = line.match(new RegExp(`^${escapeRegExp(key)}\\s*:\\s*(.*)$`));
        if (!match) {
            remaining.push(line);
            continue;
        }

        const indentLength = 0;
        const tail = match[1].trim();
        if (!tail) {
            let cursor = index + 1;
            while (cursor < lines.length) {
                const nextLine = lines[cursor];
                if (!nextLine.trim()) {
                    const lookahead = lines.slice(cursor + 1).find((candidate) => candidate.trim());
                    if (!lookahead) {
                        cursor = lines.length;
                        break;
                    }
                    const lookaheadIndent = lookahead.match(/^(\s*)/)?.[1].length ?? 0;
                    if (lookaheadIndent > indentLength) {
                        cursor += 1;
                        continue;
                    }
                    break;
                }

                const nextIndentLength = nextLine.match(/^(\s*)/)?.[1].length ?? 0;
                if (nextIndentLength > indentLength) {
                    cursor += 1;
                    continue;
                }
                break;
            }
            index = cursor - 1;
        }
    }

    return remaining.join("\n").trim();
}

function normalizeOverrideValue(value) {
    const trimmed = String(value ?? "").trim();
    if (!trimmed) {
        return "default";
    }
    return /^default$/i.test(trimmed) ? "default" : trimmed;
}

function resolveServiceFrontmatterOverrides() {
    return SERVICE_FRONTMATTER_OVERRIDE_DEFINITIONS
        .map((definition) => {
            const value = normalizeOverrideValue(
                process.env[definition.env] ?? SERVICE_FRONTMATTER_OVERRIDE_DEFAULTS[definition.id] ?? "default",
            );
            return {
                ...definition,
                value,
            };
        })
        .filter((definition) => definition.value !== "default");
}

function enforceServiceFrontmatter(frontmatter) {
    const activeOverrides = resolveServiceFrontmatterOverrides();
    let result = frontmatter.trim();

    for (const definition of activeOverrides) {
        if (definition.type === "top-level") {
            result = removeTopLevelFrontmatterKey(result, definition.key);
        }
    }

    const injectedLines = activeOverrides
        .filter((definition) => definition.type === "top-level")
        .map((definition) => `${definition.key}: ${definition.value}`)
        .join("\n");

    result = result
        ? `${result}\n${injectedLines}`
        : injectedLines;

    for (const definition of activeOverrides) {
        if (definition.type === "nested") {
            result = upsertTopLevelNestedKey(result, definition.parentKey, definition.key, definition.value);
        }
    }

    return result;
}

function upsertTopLevelNestedKey(frontmatter, parentKey, childKey, value) {
    const lines = frontmatter.split("\n");
    const parentIndex = lines.findIndex((line) => new RegExp(`^${escapeRegExp(parentKey)}\\s*:\\s*(.*)$`).test(line));

    if (parentIndex === -1) {
        return frontmatter
            ? `${frontmatter}\n${parentKey}:\n  ${childKey}: ${value}`
            : `${parentKey}:\n  ${childKey}: ${value}`;
    }

    const match = lines[parentIndex].match(new RegExp(`^${escapeRegExp(parentKey)}\\s*:\\s*(.*)$`));
    const tail = match?.[1]?.trim() ?? "";

    if (tail.startsWith("{") && tail.endsWith("}")) {
        const body = tail.slice(1, -1).trim();
        const entries = body
            .split(",")
            .map((part) => part.trim())
            .filter(Boolean)
            .filter((part) => !new RegExp(`^${escapeRegExp(childKey)}\\s*:`).test(part));

        entries.push(`${childKey}: ${value}`);
        lines[parentIndex] = `${parentKey}: { ${entries.join(", ")} }`;
        return lines.join("\n");
    }

    if (tail) {
        lines.splice(parentIndex, 1, `${parentKey}:`, `  ${childKey}: ${value}`);
        return lines.join("\n");
    }

    let blockEnd = parentIndex + 1;
    let childIndent = "  ";

    while (blockEnd < lines.length) {
        const line = lines[blockEnd];
        if (!line.trim()) {
            blockEnd += 1;
            continue;
        }

        const indent = line.match(/^(\s*)/)?.[1] ?? "";
        if (indent.length === 0) {
            break;
        }

        childIndent = indent;
        blockEnd += 1;
    }

    const nextLines = [lines[parentIndex]];
    let inserted = false;

    for (let index = parentIndex + 1; index < blockEnd; index += 1) {
        const line = lines[index];
        if (!inserted && line.trim()) {
            nextLines.push(`${childIndent}${childKey}: ${value}`);
            inserted = true;
        }

        if (new RegExp(`^\\s+${escapeRegExp(childKey)}\\s*:`).test(line)) {
            continue;
        }

        nextLines.push(line);
    }

    if (!inserted) {
        nextLines.push(`${childIndent}${childKey}: ${value}`);
    }

    lines.splice(parentIndex, blockEnd - parentIndex, ...nextLines);
    return lines.join("\n");
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
    includeRendererDefaults = false,
} = {}) {
    const normalizedMarkdown = normalizeText(markdown);
    const trimmed = normalizedMarkdown.trim();

    if (!trimmed) {
        const frontmatterLines = [];
        if (title) {
            frontmatterLines.push(`title: ${JSON.stringify(title)}`);
        }
        if (includeRendererDefaults) {
            frontmatterLines.push("theme: default", "mdc: true");
        }
        const enforced = enforceServiceFrontmatter(frontmatterLines.join("\n"));
        return `---\n${enforced}\n---\n`;
    }

    if (trimmed.startsWith("---")) {
        const match = normalizedMarkdown.match(/^---\r?\n([\s\S]*?)\r?\n---/);
        if (match) {
            const enforced = enforceServiceFrontmatter(match[1]);
            const withForcedFrontmatter = normalizedMarkdown.replace(match[1], enforced).replace(/\s*$/, "\n");
            return sanitizeHostedRendererMarkdownSyntax(withForcedFrontmatter);
        }
    }

    const frontmatterLines = [];
    if (title) {
        frontmatterLines.push(`title: ${JSON.stringify(title)}`);
    }
    if (includeRendererDefaults) {
        frontmatterLines.push("theme: default", "mdc: true");
    }

    const enforced = enforceServiceFrontmatter(frontmatterLines.join("\n"));
    return sanitizeHostedRendererMarkdownSyntax(`---\n${enforced}\n---\n\n${trimmed}\n`);
}

export function buildDeckMarkdown(input) {
    const title = normalizeTitle(input.title);
    const content = normalizeText(input.content).trim();

    if (!content) {
        return `${enforceServiceFrontmatterOnMarkdown("", {
            title,
            includeRendererDefaults: true,
        })}\n# ${title}\n\nStart writing to generate slides.\n`;
    }

    return enforceServiceFrontmatterOnMarkdown(content, {
        title,
        includeRendererDefaults: true,
    });
}

function sanitizeRelativePath(relativePath) {
    const normalizedPath = normalize(relativePath)
        .replace(/^(\.\.(\/|\\|$))+/, "")
        .replace(/^[/\\]+/, "");
    if (!normalizedPath || normalizedPath.startsWith("..")) {
        throw new Error(`Invalid asset path: ${relativePath}`);
    }
    return normalizedPath;
}

function normalizeBasePath(basePath) {
    const trimmed = basePath?.trim();
    if (!trimmed) {
        throw new Error("Preview basePath is required.");
    }
    return `/${trimmed.replace(/^\/+|\/+$/g, "")}/`;
}

function sanitizePreviewId(previewId) {
    const normalizedId = previewId?.trim();
    if (!normalizedId || !PREVIEW_ID_PATTERN.test(normalizedId)) {
        throw new Error("Invalid previewId. Only letters, numbers, dot, underscore, and dash are allowed.");
    }
    return normalizedId;
}

function normalizePreviewBasePath(previewId, basePath) {
    const normalizedBasePath = normalizeBasePath(basePath || `/p/${previewId}/`);
    const expectedBasePath = `/p/${previewId}/`;
    if (normalizedBasePath !== expectedBasePath) {
        throw new Error(`Preview basePath must match ${expectedBasePath}`);
    }
    return normalizedBasePath;
}

function getCliPath() {
    if (process.env.SLIDEV_CLI_PATH) {
        return process.env.SLIDEV_CLI_PATH;
    }
    return join(process.cwd(), "node_modules", "@slidev", "cli", "bin", "slidev.mjs");
}

function getWorkDir(jobId) {
    return join(process.cwd(), ".slidev-workspaces", jobId);
}

function getArtifactDir(jobId) {
    return join(process.cwd(), ".slidev-artifacts", RENDER_ARTIFACTS_DIRNAME, jobId);
}

function getPreviewArtifactDir(previewId) {
    return join(process.cwd(), ".slidev-artifacts", PREVIEW_ARTIFACTS_DIRNAME, sanitizePreviewId(previewId));
}

function getPreviewBuildCacheFilePath(previewId) {
    return join(process.cwd(), ".slidev-artifacts", PREVIEW_BUILD_CACHE_DIRNAME, `${sanitizePreviewId(previewId)}.json`);
}

function getRenderBuildCacheFilePath(cacheKey) {
    return join(process.cwd(), ".slidev-artifacts", RENDER_BUILD_CACHE_DIRNAME, `${cacheKey}.json`);
}

function getPreviewArtifactsRootDir() {
    return join(process.cwd(), ".slidev-artifacts", PREVIEW_ARTIFACTS_DIRNAME);
}

function getRenderArtifactsRootDir() {
    return join(process.cwd(), ".slidev-artifacts", RENDER_ARTIFACTS_DIRNAME);
}

function getPreviewCacheRootDir() {
    return join(process.cwd(), ".slidev-artifacts", PREVIEW_BUILD_CACHE_DIRNAME);
}

function getRenderCacheRootDir() {
    return join(process.cwd(), ".slidev-artifacts", RENDER_BUILD_CACHE_DIRNAME);
}

function isPathInside(rootDir, targetPath) {
    if (!rootDir || !targetPath) {
        return false;
    }

    const normalizedRoot = resolve(rootDir).replace(/[\\/]+$/, "").toLowerCase();
    const normalizedTarget = resolve(targetPath).toLowerCase();
    return normalizedTarget === normalizedRoot || normalizedTarget.startsWith(`${normalizedRoot}\\`) || normalizedTarget.startsWith(`${normalizedRoot}/`);
}

function parseCreatedAt(value) {
    const createdAtMs = Date.parse(String(value ?? ""));
    return Number.isFinite(createdAtMs) ? createdAtMs : null;
}

function isExpired(createdAt, now = Date.now()) {
    const createdAtMs = parseCreatedAt(createdAt);
    if (createdAtMs == null) {
        return true;
    }
    return now - createdAtMs >= LOCAL_ARTIFACT_RETENTION_MS;
}

async function listSubdirectories(rootDir) {
    try {
        const entries = await readdir(rootDir, {withFileTypes: true});
        return entries
            .filter((entry) => entry.isDirectory())
            .map((entry) => join(rootDir, entry.name));
    } catch {
        return [];
    }
}

async function removeDirIfExists(dirPath) {
    await rm(dirPath, {recursive: true, force: true}).catch(() => {
    });
}

async function removeFileIfExists(filePath) {
    await rm(filePath, {force: true}).catch(() => {
    });
}

async function writeAssets(rootDir, assets = []) {
    for (const asset of assets) {
        const relativePath = sanitizeRelativePath(asset.path);
        const targetPath = join(rootDir, relativePath);
        await mkdir(dirname(targetPath), {recursive: true});
        await writeFile(targetPath, Buffer.from(asset.contentBase64, "base64"));
    }
}

async function writeSourceFiles(rootDir, files = []) {
    for (const file of files) {
        const relativePath = sanitizeRelativePath(file.path);
        const targetPath = join(rootDir, relativePath);
        await mkdir(dirname(targetPath), {recursive: true});
        if (typeof file.content === "string") {
            await writeFile(targetPath, file.content, "utf8");
            continue;
        }
        await writeFile(targetPath, Buffer.from(file.contentBase64, "base64"));
    }
}

async function isFile(filePath) {
    try {
        const fileStat = await stat(filePath);
        return fileStat.isFile();
    } catch {
        return false;
    }
}

async function readJsonFile(filePath) {
    try {
        return JSON.parse(await readFile(filePath, "utf8"));
    } catch {
        return null;
    }
}

async function runSlidevCommand(args, cwd) {
    const cliArgs = [...args, ...SLIDEV_RENDERER_CLI_ARGS];
    console.log(`[slidev] run: ${cliArgs.join(" ")}`);
    return new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [getCliPath(), ...cliArgs], {
            cwd,
            stdio: ["ignore", "pipe", "pipe"],
            windowsHide: true,
        });

        let stdout = "";
        let stderr = "";

        child.stdout.on("data", (chunk) => {
            stdout += chunk.toString();
        });
        child.stderr.on("data", (chunk) => {
            stderr += chunk.toString();
        });

        child.once("error", reject);
        child.once("exit", (code) => {
            if (code === 0) {
                console.log(`[slidev] done: ${args[0]}, exit=0`);
                resolve({stdout, stderr});
                return;
            }

            console.error(`[slidev] failed: ${args[0]}, exit=${code}\n${(stderr || stdout).slice(0, 500)}`);
            reject(new Error(`Slidev command failed with exit code ${code}.\n${stderr || stdout}`));
        });
    });
}

function scheduleArtifactCleanup(jobId, {cacheFilePath} = {}) {
    const existingTimer = renderArtifactCleanupTimers.get(jobId);
    if (existingTimer) {
        clearTimeout(existingTimer);
    }

    const timer = setTimeout(() => {
        renderArtifactCleanupTimers.delete(jobId);
        void rm(getArtifactDir(jobId), {recursive: true, force: true}).catch(() => {
        });
        if (cacheFilePath) {
            void rm(cacheFilePath, {force: true}).catch(() => {
            });
        }
    }, LOCAL_ARTIFACT_RETENTION_MS);

    renderArtifactCleanupTimers.set(jobId, timer);
}

async function listRelativeFiles(rootDir, currentDir = rootDir) {
    const entries = await readdir(currentDir, {withFileTypes: true});
    const results = [];

    for (const entry of entries) {
        const absolutePath = join(currentDir, entry.name);
        if (entry.isDirectory()) {
            results.push(...await listRelativeFiles(rootDir, absolutePath));
            continue;
        }
        if (!entry.isFile()) {
            continue;
        }
        results.push(absolutePath.slice(rootDir.length + 1).replace(/\\/g, "/"));
    }

    return results.sort((left, right) => left.localeCompare(right));
}

function createInlineSourceFiles(input) {
    if (input.source?.files?.length) {
        const entryPath = sanitizeRelativePath(input.entry || "slides.md");
        return input.source.files.map((file) => {
            const relativePath = sanitizeRelativePath(file.path);
            if (typeof file.content === "string") {
                return {
                    path: relativePath,
                    content: relativePath === entryPath
                        ? enforceServiceFrontmatterOnMarkdown(file.content, {title: input.title})
                        : file.content,
                };
            }
            return {
                path: relativePath,
                contentBase64: file.contentBase64,
            };
        });
    }

    const sourceEntry = sanitizeRelativePath(input.entry || "slides.md");
    const files = [
        {
            path: sourceEntry,
            content: buildDeckMarkdown(input),
        },
    ];

    for (const asset of input.assets ?? []) {
        files.push({
            path: sanitizeRelativePath(asset.path),
            contentBase64: asset.contentBase64,
        });
    }

    return files;
}

function ensureSourceEntryExists(files, sourceEntry) {
    const normalizedEntry = sanitizeRelativePath(sourceEntry);
    if (!files.some((file) => sanitizeRelativePath(file.path) === normalizedEntry)) {
        throw new Error(`Preview source entry file not found: ${normalizedEntry}`);
    }
    return normalizedEntry;
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

function normalizeRenderAssetsForHash(assets = []) {
    return assets
        .map((asset) => ({
            path: sanitizeRelativePath(asset.path),
            contentBase64: asset.contentBase64,
        }))
        .sort((left, right) => left.path.localeCompare(right.path));
}

function createPreviewSourceHash({basePath, sourceEntry, sourceFiles}) {
    return createHash("sha256")
        .update(JSON.stringify({
            version: PREVIEW_BUILD_CACHE_VERSION,
            basePath,
            sourceEntry,
            sourceFiles: normalizeSourceFilesForHash(sourceFiles),
        }))
        .digest("hex");
}

function buildRenderOutputMetadata(input) {
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

function createRenderArtifactSourceHash({format, markdown, assets, outputFileName}) {
    return createHash("sha256")
        .update(JSON.stringify({
            version: RENDER_BUILD_CACHE_VERSION,
            format,
            outputFileName,
            markdown,
            assets: normalizeRenderAssetsForHash(assets),
        }))
        .digest("hex");
}

async function readPreviewBuildCache(previewId) {
    return readJsonFile(getPreviewBuildCacheFilePath(previewId));
}

async function readRenderBuildCache(cacheKey) {
    return readJsonFile(getRenderBuildCacheFilePath(cacheKey));
}

async function writePreviewBuildCache({
                                          previewId,
                                          buildId,
                                          basePath,
                                          sourceEntry,
                                          sourceHash,
                                          outputDir,
                                          manifestFilePath,
                                          createdAt,
                                          publishResult,
                                      }) {
    const cacheFilePath = getPreviewBuildCacheFilePath(previewId);
    await mkdir(dirname(cacheFilePath), {recursive: true});
    await writeFile(cacheFilePath, `${JSON.stringify({
        version: PREVIEW_BUILD_CACHE_VERSION,
        previewId,
        buildId,
        basePath,
        sourceEntry,
        sourceHash,
        outputDir,
        manifestFilePath,
        createdAt,
        publishResult: publishResult ?? null,
    }, null, 2)}\n`, "utf8");
}

async function writeRenderBuildCache({
                                         cacheKey,
                                         jobId,
                                         format,
                                         outputFileName,
                                         artifactPath,
                                         artifactDir,
                                         artifactFilePath,
                                         outputDir,
                                         sourceHash,
                                         createdAt,
                                         publishResult,
                                     }) {
    const cacheFilePath = getRenderBuildCacheFilePath(cacheKey);
    await mkdir(dirname(cacheFilePath), {recursive: true});
    await writeFile(cacheFilePath, `${JSON.stringify({
        version: RENDER_BUILD_CACHE_VERSION,
        cacheKey,
        jobId,
        format,
        outputFileName,
        artifactPath,
        artifactDir,
        artifactFilePath: artifactFilePath ?? null,
        outputDir: outputDir ?? null,
        sourceHash,
        createdAt,
        publishResult: publishResult ?? null,
    }, null, 2)}\n`, "utf8");
}

async function resolveCachedPreviewBuild({
                                             previewId,
                                             basePath,
                                             sourceEntry,
                                             sourceHash,
                                             outputDir,
                                             manifestFilePath,
                                         }) {
    const cache = await readPreviewBuildCache(previewId);
    if (!cache) {
        return null;
    }

    if (
        cache.version !== PREVIEW_BUILD_CACHE_VERSION
        || cache.previewId !== previewId
        || cache.basePath !== basePath
        || cache.sourceEntry !== sourceEntry
        || cache.sourceHash !== sourceHash
    ) {
        return null;
    }

    const manifest = await readJsonFile(manifestFilePath);
    if (!manifest || manifest.buildId !== cache.buildId) {
        return null;
    }

    const entry = typeof manifest.entry === "string" && manifest.entry ? manifest.entry : "index.html";
    if (!await isFile(join(outputDir, entry))) {
        return null;
    }

    return {
        buildId: cache.buildId,
        previewId,
        basePath,
        sourceEntry,
        sourceHash,
        previewPath: basePath,
        outputDir,
        manifest,
        manifestFilePath,
        cacheHit: true,
    };
}

async function resolveCachedRenderArtifact({
                                               cacheKey,
                                               sourceHash,
                                               format,
                                           }) {
    const cache = await readRenderBuildCache(cacheKey);
    if (!cache) {
        return null;
    }

    if (
        cache.version !== RENDER_BUILD_CACHE_VERSION
        || cache.cacheKey !== cacheKey
        || cache.sourceHash !== sourceHash
        || cache.format !== format
        || typeof cache.jobId !== "string"
        || typeof cache.artifactPath !== "string"
        || typeof cache.outputFileName !== "string"
        || typeof cache.artifactDir !== "string"
    ) {
        return null;
    }

    if (format === "web") {
        const outputDir = typeof cache.outputDir === "string" ? cache.outputDir : join(cache.artifactDir, "web");
        if (!await isFile(join(outputDir, "index.html"))) {
            return null;
        }

        return {
            jobId: cache.jobId,
            format,
            artifactPath: cache.artifactPath,
            fileName: cache.outputFileName,
            artifactDir: cache.artifactDir,
            artifactFilePath: null,
            outputDir,
            sourceHash,
            cacheKey,
            cacheHit: true,
        };
    }

    if (typeof cache.artifactFilePath !== "string" || !await isFile(cache.artifactFilePath)) {
        return null;
    }

    return {
        jobId: cache.jobId,
        format,
        artifactPath: cache.artifactPath,
        fileName: cache.outputFileName,
        artifactDir: cache.artifactDir,
        artifactFilePath: cache.artifactFilePath,
        outputDir: null,
        sourceHash,
        cacheKey,
        cacheHit: true,
    };
}

export async function getCachedPreviewPublishResult({previewId, buildId}) {
    const cache = await readPreviewBuildCache(previewId);
    if (!cache || cache.buildId !== buildId || !cache.publishResult) {
        return null;
    }

    return cache.publishResult;
}

export async function updateCachedPreviewPublishResult({previewId, buildId, publishResult}) {
    const cache = await readPreviewBuildCache(previewId);
    if (!cache || cache.buildId !== buildId) {
        return;
    }

    await writePreviewBuildCache({
        previewId,
        buildId,
        basePath: cache.basePath,
        sourceEntry: cache.sourceEntry,
        sourceHash: cache.sourceHash,
        outputDir: cache.outputDir,
        manifestFilePath: cache.manifestFilePath,
        createdAt: cache.createdAt,
        publishResult,
    });
}

export async function getCachedRenderPublishResult({cacheKey, jobId}) {
    const cache = await readRenderBuildCache(cacheKey);
    if (!cache || cache.jobId !== jobId || !cache.publishResult) {
        return null;
    }

    return cache.publishResult;
}

export async function updateCachedRenderPublishResult({cacheKey, jobId, publishResult}) {
    const cache = await readRenderBuildCache(cacheKey);
    if (!cache || cache.jobId !== jobId) {
        return;
    }

    await writeRenderBuildCache({
        cacheKey,
        jobId,
        format: cache.format,
        outputFileName: cache.outputFileName,
        artifactPath: cache.artifactPath,
        artifactDir: cache.artifactDir,
        artifactFilePath: cache.artifactFilePath,
        outputDir: cache.outputDir,
        sourceHash: cache.sourceHash,
        createdAt: cache.createdAt,
        publishResult,
    });
}

async function cleanupPreviewArtifacts({now, retainedDirs}) {
    const previewArtifactsRootDir = getPreviewArtifactsRootDir();
    const previewCacheRootDir = getPreviewCacheRootDir();

    try {
        const cacheEntries = await readdir(previewCacheRootDir, {withFileTypes: true});
        for (const entry of cacheEntries) {
            if (!entry.isFile() || !entry.name.endsWith(".json")) {
                continue;
            }

            const cacheFilePath = join(previewCacheRootDir, entry.name);
            const cache = await readJsonFile(cacheFilePath);
            if (!cache || isExpired(cache.createdAt, now)) {
                const outputDir = typeof cache?.outputDir === "string" && isPathInside(previewArtifactsRootDir, cache.outputDir)
                    ? cache.outputDir
                    : null;
                if (outputDir) {
                    await removeDirIfExists(outputDir);
                }
                await removeFileIfExists(cacheFilePath);
                continue;
            }

            if (typeof cache.outputDir === "string" && isPathInside(previewArtifactsRootDir, cache.outputDir)) {
                retainedDirs.add(resolve(cache.outputDir).toLowerCase());
            }
        }
    } catch {
    }

    for (const dirPath of await listSubdirectories(previewArtifactsRootDir)) {
        if (retainedDirs.has(resolve(dirPath).toLowerCase())) {
            continue;
        }

        try {
            const fileStat = await stat(dirPath);
            if (now - fileStat.mtimeMs >= LOCAL_ARTIFACT_RETENTION_MS) {
                await removeDirIfExists(dirPath);
            }
        } catch {
        }
    }
}

async function cleanupRenderArtifacts({now, retainedDirs}) {
    const renderArtifactsRootDir = getRenderArtifactsRootDir();
    const renderCacheRootDir = getRenderCacheRootDir();

    try {
        const cacheEntries = await readdir(renderCacheRootDir, {withFileTypes: true});
        for (const entry of cacheEntries) {
            if (!entry.isFile() || !entry.name.endsWith(".json")) {
                continue;
            }

            const cacheFilePath = join(renderCacheRootDir, entry.name);
            const cache = await readJsonFile(cacheFilePath);
            if (!cache || isExpired(cache.createdAt, now)) {
                const artifactDir = typeof cache?.artifactDir === "string" && isPathInside(renderArtifactsRootDir, cache.artifactDir)
                    ? cache.artifactDir
                    : null;
                if (artifactDir && typeof cache?.jobId === "string") {
                    const existingTimer = renderArtifactCleanupTimers.get(cache.jobId);
                    if (existingTimer) {
                        clearTimeout(existingTimer);
                        renderArtifactCleanupTimers.delete(cache.jobId);
                    }
                }
                if (artifactDir) {
                    await removeDirIfExists(artifactDir);
                }
                await removeFileIfExists(cacheFilePath);
                continue;
            }

            if (typeof cache.artifactDir === "string" && isPathInside(renderArtifactsRootDir, cache.artifactDir)) {
                retainedDirs.add(resolve(cache.artifactDir).toLowerCase());
            }
        }
    } catch {
    }

    for (const dirPath of await listSubdirectories(renderArtifactsRootDir)) {
        if (retainedDirs.has(resolve(dirPath).toLowerCase())) {
            continue;
        }

        try {
            const fileStat = await stat(dirPath);
            if (now - fileStat.mtimeMs >= LOCAL_ARTIFACT_RETENTION_MS) {
                await removeDirIfExists(dirPath);
            }
        } catch {
        }
    }
}

export async function cleanupExpiredLocalArtifacts({now = Date.now()} = {}) {
    if (artifactCleanupRun) {
        return artifactCleanupRun;
    }

    artifactCleanupRun = (async () => {
        const retainedPreviewDirs = new Set();
        const retainedRenderDirs = new Set();

        await cleanupPreviewArtifacts({now, retainedDirs: retainedPreviewDirs});
        await cleanupRenderArtifacts({now, retainedDirs: retainedRenderDirs});
    })().finally(() => {
        artifactCleanupRun = null;
    });

    return artifactCleanupRun;
}

export function startArtifactCleanupScheduler() {
    if (artifactCleanupTimer) {
        return;
    }

    void cleanupExpiredLocalArtifacts();
    artifactCleanupTimer = setInterval(() => {
        void cleanupExpiredLocalArtifacts();
    }, LOCAL_ARTIFACT_CLEANUP_INTERVAL_MS);
    artifactCleanupTimer.unref?.();
}

async function writePreviewManifest({previewId, buildId, basePath, outputDir, sourceEntry}) {
    const files = await listRelativeFiles(outputDir);
    const manifest = {
        id: previewId,
        buildId,
        basePath,
        entry: "index.html",
        spaFallback: true,
        assetPrefixes: ["assets/"],
        privateFiles: ["manifest.json"],
        sourceEntry,
        files,
        createdAt: new Date().toISOString(),
    };

    const manifestFilePath = join(outputDir, "manifest.json");
    await writeFile(manifestFilePath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    return {
        manifest,
        manifestFilePath,
    };
}

export async function renderArtifact(input) {
    const {outputFileName} = buildRenderOutputMetadata(input);
    const markdown = buildDeckMarkdown(input);
    const sourceHash = createRenderArtifactSourceHash({
        format: input.format,
        markdown,
        assets: input.assets ?? [],
        outputFileName,
    });
    const cacheKey = sourceHash;

    const cachedArtifact = await resolveCachedRenderArtifact({
        cacheKey,
        sourceHash,
        format: input.format,
    });
    if (cachedArtifact) {
        scheduleArtifactCleanup(cachedArtifact.jobId, {
            cacheFilePath: getRenderBuildCacheFilePath(cacheKey),
        });
        return cachedArtifact;
    }

    const jobId = randomUUID();
    const workDir = getWorkDir(jobId);
    const artifactDir = getArtifactDir(jobId);
    const entryFilePath = join(workDir, "slides.md");
    const cacheFilePath = getRenderBuildCacheFilePath(cacheKey);

    await rm(workDir, {recursive: true, force: true});
    await rm(artifactDir, {recursive: true, force: true});
    await mkdir(workDir, {recursive: true});
    await mkdir(artifactDir, {recursive: true});

    try {
        await writeFile(entryFilePath, markdown, "utf8");
        await writeAssets(workDir, input.assets ?? []);

        if (input.format === "web") {
            const outDir = join(artifactDir, "web");
            const artifactPath = `/artifacts/${jobId}/web/`;
            await runSlidevCommand(
                [
                    "build",
                    entryFilePath,
                    "--out",
                    outDir,
                    "--base",
                    artifactPath,
                ],
                workDir,
            );

            await writeRenderBuildCache({
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

            scheduleArtifactCleanup(jobId, {cacheFilePath});
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

        await runSlidevCommand(
            [
                "export",
                entryFilePath,
                "--format",
                input.format,
                "--output",
                outputFilePath,
                "--timeout",
                String(EXPORT_TIMEOUT_MS),
            ],
            workDir,
        );

        await writeRenderBuildCache({
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

        scheduleArtifactCleanup(jobId, {cacheFilePath});
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
    const previewId = sanitizePreviewId(input.previewId);
    const basePath = normalizePreviewBasePath(previewId, input.basePath);
    const sourceFiles = createInlineSourceFiles(input);
    const sourceEntry = ensureSourceEntryExists(sourceFiles, input.entry || "slides.md");
    const outputDir = getPreviewArtifactDir(previewId);
    const manifestFilePath = join(outputDir, "manifest.json");
    const sourceHash = createPreviewSourceHash({basePath, sourceEntry, sourceFiles});

    console.log(`[build] BuildPreviewSite start: previewId=${previewId}, sourceHash=${sourceHash.slice(0, 12)}...`);

    const cachedPreview = await resolveCachedPreviewBuild({
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
        const slidevStartedAt = Date.now();
        await runSlidevCommand(
            [
                "build",
                entryFilePath,
                "--out",
                outputDir,
                "--base",
                basePath,
            ],
            workDir,
        );
        console.log(`[build] slidev build finished: previewId=${previewId}, buildMs=${Date.now() - slidevStartedAt}`);

        const {manifest, manifestFilePath} = await writePreviewManifest({
            previewId,
            buildId,
            basePath,
            outputDir,
            sourceEntry,
        });

        await writePreviewBuildCache({
            previewId,
            buildId,
            basePath,
            sourceEntry,
            sourceHash,
            outputDir,
            manifestFilePath,
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
            manifestFilePath,
            cacheHit: false,
        };
    } finally {
        await rm(workDir, {recursive: true, force: true}).catch(() => {
        });
    }
}
