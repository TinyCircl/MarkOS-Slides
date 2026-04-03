import {copyFile, mkdir, readFile, readdir, stat, writeFile} from "node:fs/promises";
import {basename, dirname, extname, join, relative, resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {parseDeck, getDeckTitle, getDeckViewport} from "./parser.mjs";
import {getRenderedSlides, renderMarkosDocument} from "./render.mjs";

export const MARKOS_WEB_ENGINE_NAME = "markos-web";

const SKIPPED_SOURCE_EXTENSIONS = new Set([".css", ".md", ".markdown", ".mdx", ".vue", ".js", ".jsx", ".ts", ".tsx"]);
const PACKAGE_ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const BUILTIN_ASSETS_DIR = join(PACKAGE_ROOT, "assets");

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

async function pathExists(targetPath) {
    try {
        await stat(targetPath);
        return true;
    } catch {
        return false;
    }
}

async function resolveBundledCssSource(entryFilePath) {
    const siblingCssPath = join(
        dirname(entryFilePath),
        `${basename(entryFilePath, extname(entryFilePath))}.css`,
    );
    return await pathExists(siblingCssPath) ? siblingCssPath : null;
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
    const bundledCssSource = await resolveBundledCssSource(entryFilePath);
    const bundledCss = bundledCssSource ? await bundleCssFile(bundledCssSource) : "";

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

// eslint-disable-next-line no-unused-vars
async function exportArtifact({entryFilePath, format, outputFilePath, cwd}) {
    throw new Error(`Render format "${format}" is not supported by ${MARKOS_WEB_ENGINE_NAME}. Only "web" is currently available.`);
}

export const markosWebRenderEngine = {
    name: MARKOS_WEB_ENGINE_NAME,
    buildStaticSite,
    exportArtifact,
};
