import {createHash, randomUUID} from "node:crypto";
import {spawn} from "node:child_process";
import {mkdir, readFile, readdir, rm, stat, writeFile} from "node:fs/promises";
import {dirname, join, normalize} from "node:path";

const ARTIFACT_IDLE_TTL_MS = Number(process.env.SLIDEV_ARTIFACT_TTL_MS || 60 * 60 * 1000);
const PREVIEW_BUILD_CACHE_VERSION = 1;
const SLIDEV_RENDERER_CLI_ARGS = ["--fault-tolerant"];

function normalizeText(value) {
    return value.replace(/\r\n?/g, "\n");
}

function normalizeTitle(title) {
    const trimmed = title?.trim();
    return trimmed && trimmed.length > 0 ? trimmed : "Untitled Slides";
}

// Service-level forced config: permanently disable features that are not needed
// in the hosted renderer. These values override the incoming entry markdown.
const SERVICE_FORCED_FRONTMATTER = [
    ["monaco", "false"],
    ["presenter", "false"],
    ["drawings", "{enabled: false}"],
    ["wakeLock", "false"],
    ["record", "false"],
    ["browserExporter", "false"],
    ["codeCopy", "false"],
    ["contextMenu", "false"],
    ["preloadImages", "false"],
];

const RE_MONACO_CODE_FENCE = /^(```[^\n]*?)\s*\{monaco(?:-run|-diff)?\}([^\n]*)$/gm;
const RE_MONACO_SNIPPET = /^(\s*<<<[^\n]*?)\{monaco-write\}([^\n]*)$/gm;

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

function enforceServiceFrontmatter(frontmatter) {
    let result = frontmatter.trim();
    for (const [key] of SERVICE_FORCED_FRONTMATTER) {
        result = removeTopLevelFrontmatterKey(result, key);
    }

    const injectedLines = SERVICE_FORCED_FRONTMATTER
        .map(([key, value]) => `${key}: ${value}`)
        .join("\n");

    return result
        ? `${result}\n${injectedLines}`
        : injectedLines;
}

function joinMarkdownLine(prefix, suffix = "") {
    const normalizedPrefix = prefix.replace(/\s+$/g, "");
    const normalizedSuffix = suffix.trim();
    return normalizedSuffix
        ? `${normalizedPrefix} ${normalizedSuffix}`
        : normalizedPrefix;
}

function sanitizeHostedRendererMarkdownSyntax(markdown) {
    return markdown
        .replace(RE_MONACO_CODE_FENCE, (_full, prefix = "", suffix = "") => joinMarkdownLine(prefix, suffix))
        .replace(RE_MONACO_SNIPPET, (_full, prefix = "", suffix = "") => joinMarkdownLine(prefix, suffix));
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
    return join(process.cwd(), ".slidev-artifacts", jobId);
}

function getPreviewArtifactDir(previewId) {
    return join(process.cwd(), ".slidev-artifacts", "previews", previewId);
}

function getPreviewBuildCacheFilePath(previewId) {
    return join(process.cwd(), ".slidev-artifacts", "preview-cache", `${previewId}.json`);
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

function scheduleArtifactCleanup(jobId) {
    setTimeout(() => {
        void rm(getWorkDir(jobId), {recursive: true, force: true}).catch(() => {
        });
        void rm(getArtifactDir(jobId), {recursive: true, force: true}).catch(() => {
        });
    }, ARTIFACT_IDLE_TTL_MS);
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

async function readPreviewBuildCache(previewId) {
    return readJsonFile(getPreviewBuildCacheFilePath(previewId));
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
    const jobId = randomUUID();
    const workDir = getWorkDir(jobId);
    const artifactDir = getArtifactDir(jobId);
    const entryFilePath = join(workDir, "slides.md");

    await mkdir(workDir, {recursive: true});
    await mkdir(artifactDir, {recursive: true});
    await writeFile(entryFilePath, buildDeckMarkdown(input), "utf8");
    await writeAssets(workDir, input.assets ?? []);

    if (input.format === "web") {
        const outDir = join(artifactDir, "web");
        await runSlidevCommand(
            [
                "build",
                entryFilePath,
                "--out",
                outDir,
                "--base",
                `/artifacts/${jobId}/web/`,
            ],
            workDir,
        );

        scheduleArtifactCleanup(jobId);
        return {
            jobId,
            format: "web",
            artifactPath: `/artifacts/${jobId}/web/`,
            fileName: "index.html",
        };
    }

    const extension = input.format;
    const baseName = (input.fileName?.trim() || normalizeTitle(input.title)).replace(/[<>:"/\\|?*\x00-\x1F]/g, "_");
    const outputFileName = `${baseName}.${extension}`;
    const outputFilePath = join(artifactDir, outputFileName);

    await runSlidevCommand(
        [
            "export",
            entryFilePath,
            "--format",
            input.format,
            "--output",
            outputFilePath,
        ],
        workDir,
    );

    scheduleArtifactCleanup(jobId);
    return {
        jobId,
        format: input.format,
        artifactPath: `/artifacts/${jobId}/${outputFileName}`,
        fileName: outputFileName,
    };
}

export async function buildPreviewSite(input) {
    const previewId = input.previewId.trim();
    const basePath = normalizeBasePath(input.basePath || `/p/${previewId}/`);
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
