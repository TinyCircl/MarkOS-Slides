import {spawn} from "node:child_process";
import {copyFile, mkdir, readFile, readdir, rm, writeFile} from "node:fs/promises";
import {basename, delimiter, dirname, extname, join, relative, resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {writePreviewManifest} from "../../core/artifact-store.mjs";
import {startManifestSiteServer} from "../../core/dev-server.mjs";
import {getDeckCssFilePaths, MARKOS_THEME_WORK_DIRNAME, pathExists} from "../../core/deck-utils.mjs";
import {parseDeck, getDeckTitle, getDeckViewport} from "./parser.mjs";
import {getRenderedSlides, renderMarkosDocument} from "./render.mjs";

export const MARKOS_WEB_ENGINE_NAME = "markos-web";

const SKIPPED_SOURCE_EXTENSIONS = new Set([".css", ".md", ".markdown", ".mdx", ".vue", ".js", ".jsx", ".ts", ".tsx"]);
const PACKAGE_ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const BUILTIN_ASSETS_DIR = join(PACKAGE_ROOT, "assets");
const PDF_BROWSER_ENV_KEYS = ["MARKOS_PDF_BROWSER", "MARKOS_CHROME_PATH", "CHROME_PATH"];
const PDF_BROWSER_NAMES_BY_PLATFORM = {
    darwin: [
        "Google Chrome",
        "Google Chrome Canary",
        "Chromium",
        "Microsoft Edge",
        "Brave Browser",
    ],
    linux: [
        "google-chrome",
        "google-chrome-stable",
        "chromium-browser",
        "chromium",
        "microsoft-edge",
        "brave-browser",
    ],
    win32: [
        "chrome.exe",
        "msedge.exe",
        "brave.exe",
    ],
};

function uniqueValues(values) {
    return [...new Set(values.filter(Boolean))];
}

function isLocalCssImport(value) {
    return value && !/^(https?:|data:|blob:|\/)/i.test(value);
}

async function bundleCssFile(filePath, seen = new Set()) {
    const normalizedPath = resolve(filePath);
    if (seen.has(normalizedPath)) {
        return "";
    }
    seen.add(normalizedPath);

    const css = await readFile(normalizedPath, "utf8").catch((err) => {
        if (err?.code !== "ENOENT") console.warn("[markos] failed to read CSS file:", normalizedPath, err.message);
        return "";
    });
    const importPattern = /@import\s+(?:url\()?['"]([^'"]+)['"]\)?\s*;/g;

    let cursor = 0;
    let output = "";
    for (const match of css.matchAll(importPattern)) {
        output += css.slice(cursor, match.index);
        cursor = match.index + match[0].length;
        if (isLocalCssImport(match[1])) {
            output += await bundleCssFile(resolve(dirname(normalizedPath), match[1]), seen);
        } else {
            output += match[0];
        }
    }
    output += css.slice(cursor);
    return output;
}

async function resolveDeckCssSources(entryFilePath) {
    const cssSources = [];

    for (const cssPath of getDeckCssFilePaths(entryFilePath)) {
        if (await pathExists(cssPath)) {
            cssSources.push(cssPath);
        }
    }

    return cssSources;
}

function normalizeThemeName(value) {
    if (typeof value !== "string") {
        return null;
    }

    const trimmed = value.trim();
    if (!trimmed) {
        return null;
    }

    if (trimmed.endsWith(".css")) {
        throw new Error("Theme name must not include the .css suffix. Use the theme folder name, for example \"Clay\".");
    }

    return trimmed;
}

async function resolveThemeCssSource(workDir, deck) {
    const themeName = normalizeThemeName(deck.headmatter?.theme);
    if (!themeName) {
        return null;
    }

    const themeCssPath = join(workDir, MARKOS_THEME_WORK_DIRNAME, `${themeName}.css`);
    return await pathExists(themeCssPath) ? themeCssPath : null;
}

async function copyRenderableAssets(sourceDir, outputDir, rootDir = sourceDir) {
    const entries = await readdir(sourceDir, {withFileTypes: true});
    for (const entry of entries) {
        const sourcePath = join(sourceDir, entry.name);
        const relativePath = relative(rootDir, sourcePath);
        if (entry.isDirectory()) {
            await copyRenderableAssets(sourcePath, outputDir, rootDir);
            continue;
        }
        if (!entry.isFile()) {
            continue;
        }

        const extension = extname(entry.name).toLowerCase();
        if (SKIPPED_SOURCE_EXTENSIONS.has(extension)) {
            continue;
        }

        const targetPath = join(outputDir, relativePath);
        await mkdir(dirname(targetPath), {recursive: true});
        await copyFile(sourcePath, targetPath);
    }
}

async function copyBuiltInAssets(outputDir) {
    if (await pathExists(BUILTIN_ASSETS_DIR)) {
        await copyRenderableAssets(BUILTIN_ASSETS_DIR, outputDir, PACKAGE_ROOT);
    }
}

async function buildStaticSite({entryFilePath, outputDir, basePath, cwd}) {
    const source = await readFile(entryFilePath, "utf8");
    const deck = parseDeck(source);
    const viewport = getDeckViewport(deck);
    const title = getDeckTitle(deck, basename(entryFilePath, extname(entryFilePath)));
    const renderedSlides = getRenderedSlides(deck);
    const themeCssSource = await resolveThemeCssSource(cwd, deck);
    const deckCssSources = await resolveDeckCssSources(entryFilePath);
    const cssSources = [themeCssSource, ...deckCssSources].filter(Boolean);
    let bundledCss = "";
    for (const sourcePath of cssSources) {
        const nextCss = await bundleCssFile(sourcePath);
        if (!nextCss) {
            continue;
        }
        bundledCss = bundledCss
            ? `${bundledCss}\n\n${nextCss}`
            : nextCss;
    }

    await mkdir(outputDir, {recursive: true});
    await copyBuiltInAssets(outputDir);
    await copyRenderableAssets(cwd, outputDir);
    await writeFile(
        join(outputDir, "index.html"),
        renderMarkosDocument({
            title,
            basePath,
            viewport,
            renderedSlides,
            bundledCss,
        }),
        "utf8",
    );
}

function resolvePdfBrowserPathCandidates(env = process.env) {
    const explicit = PDF_BROWSER_ENV_KEYS
        .map((key) => env[key]?.trim())
        .filter(Boolean);

    if (process.platform === "darwin") {
        return uniqueValues([
            ...explicit,
            ...PDF_BROWSER_NAMES_BY_PLATFORM.darwin.map((name) => `/Applications/${name}.app/Contents/MacOS/${name}`),
        ]);
    }

    if (process.platform === "win32") {
        const roots = uniqueValues([
            env.PROGRAMFILES,
            env["PROGRAMFILES(X86)"],
            env.LOCALAPPDATA,
        ]);
        return uniqueValues([
            ...explicit,
            ...roots.flatMap((root) => [
                join(root, "Google", "Chrome", "Application", "chrome.exe"),
                join(root, "Microsoft", "Edge", "Application", "msedge.exe"),
                join(root, "BraveSoftware", "Brave-Browser", "Application", "brave.exe"),
            ]),
        ]);
    }

    const pathDirs = String(env.PATH || "")
        .split(delimiter)
        .filter(Boolean);
    return uniqueValues([
        ...explicit,
        ...PDF_BROWSER_NAMES_BY_PLATFORM.linux.flatMap((name) => [
            name,
            ...pathDirs.map((dirPath) => join(dirPath, name)),
        ]),
        "/snap/bin/chromium",
    ]);
}

function buildPdfBrowserArgs(outputFilePath, exportUrl, env = process.env) {
    const args = [
        "--headless=new",
        "--disable-gpu",
        "--hide-scrollbars",
        "--run-all-compositor-stages-before-draw",
        `--virtual-time-budget=${Number.parseInt(env.MARKOS_PDF_VIRTUAL_TIME_BUDGET_MS || "3000", 10) || 3000}`,
        `--print-to-pdf=${outputFilePath}`,
        "--print-to-pdf-no-header",
    ];

    if (/^(1|true)$/i.test(String(env.MARKOS_PDF_NO_SANDBOX || "").trim())) {
        args.push("--no-sandbox");
    }

    args.push(exportUrl);
    return args;
}

async function runPdfBrowser(command, args) {
    return new Promise((resolvePromise, rejectPromise) => {
        const child = spawn(command, args, {
            stdio: ["ignore", "ignore", "pipe"],
        });

        let stderr = "";

        child.once("error", rejectPromise);
        child.stderr.on("data", (chunk) => {
            stderr += String(chunk);
        });
        child.once("close", (code) => {
            if (code === 0) {
                resolvePromise();
                return;
            }

            const error = new Error(
                stderr.trim()
                    ? stderr.trim()
                    : `PDF browser exited with code ${code}.`,
            );
            error.code = code;
            rejectPromise(error);
        });
    });
}

async function renderPdfArtifact({entryFilePath, outputFilePath, cwd}) {
    const exportRootDir = join(dirname(outputFilePath), "__markos-export-site__");
    const sourceEntry = relative(cwd, entryFilePath).replace(/\\/g, "/");

    await rm(exportRootDir, {recursive: true, force: true}).catch(() => {
    });

    let devServer = null;
    try {
        await buildStaticSite({
            entryFilePath,
            outputDir: exportRootDir,
            basePath: "/",
            cwd,
        });
        await writePreviewManifest({
            previewId: "export-artifact",
            buildId: `${Date.now()}`,
            basePath: "/",
            outputDir: exportRootDir,
            sourceEntry,
        });

        devServer = await startManifestSiteServer({
            rootDir: exportRootDir,
            basePath: "/",
            host: "127.0.0.1",
            port: 0,
        });

        const exportUrl = new URL("export/", devServer.url).toString();
        const args = buildPdfBrowserArgs(outputFilePath, exportUrl);
        const candidates = resolvePdfBrowserPathCandidates();
        let lastError = null;

        for (const candidate of candidates) {
            try {
                await runPdfBrowser(candidate, args);
                if (!await pathExists(outputFilePath)) {
                    throw new Error(`PDF export finished but no file was written: ${outputFilePath}`);
                }
                return;
            } catch (error) {
                if (error?.code === "ENOENT") {
                    lastError = error;
                    continue;
                }

                const message = error instanceof Error ? error.message : String(error);
                if (/spawn .*ENOENT/i.test(message)) {
                    lastError = error;
                    continue;
                }

                throw error;
            }
        }

        throw new Error(
            "No PDF browser executable was found. Set MARKOS_PDF_BROWSER to a Chrome/Chromium executable path.",
            {cause: lastError ?? undefined},
        );
    } finally {
        await devServer?.stop?.().catch(() => {
        });
        await rm(exportRootDir, {recursive: true, force: true}).catch(() => {
        });
    }
}

async function exportArtifact({entryFilePath, format, outputFilePath, cwd}) {
    if (format === "pdf") {
        await renderPdfArtifact({
            entryFilePath,
            outputFilePath,
            cwd,
        });
        return;
    }

    throw new Error(`Render format "${format}" is not supported by ${MARKOS_WEB_ENGINE_NAME}. Supported formats: "web", "pdf".`);
}

export const markosWebRenderEngine = {
    name: MARKOS_WEB_ENGINE_NAME,
    buildStaticSite,
    exportArtifact,
};
