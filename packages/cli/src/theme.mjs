import {mkdir, readFile, writeFile} from "node:fs/promises";
import {dirname, join, resolve} from "node:path";
import {MARKOS_DEFAULT_DECK_DIR, MARKOS_DEFAULT_ENTRY} from "@tinycircl/markos-slides-core/config";
import {
    FILE_FRONTMATTER_KEYS,
    MARKOS_THEME_WORK_DIRNAME,
    escapeRegExp,
    getPathKind,
    getSiblingCssPath,
    normalizeText,
    parseYamlObject,
    upsertTopLevelKey,
} from "@tinycircl/markos-slides-core/deck-utils";

export const MARKOS_THEMES_DIRNAME = "themes";
export const MARKOS_THEME_ENTRY_FILENAME = "theme.css";

const THEME_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

function sanitizeThemeName(themeName) {
    const normalizedThemeName = themeName?.trim()?.replace(/\.css$/i, "");
    if (!normalizedThemeName || !THEME_NAME_PATTERN.test(normalizedThemeName)) {
        throw new Error("Theme name is required and may contain only letters, numbers, dot, underscore, and dash.");
    }
    return normalizedThemeName;
}

export function getThemesRoot(rootDir = process.cwd()) {
    return resolve(rootDir, MARKOS_THEMES_DIRNAME);
}

async function resolveThemeSource(themeName, {
    themesRoot = getThemesRoot(),
} = {}) {
    const resolvedThemesRoot = resolve(themesRoot);
    const themeDirectoryPath = join(resolvedThemesRoot, themeName);
    const directoryThemeFilePath = join(themeDirectoryPath, MARKOS_THEME_ENTRY_FILENAME);
    if (await getPathKind(directoryThemeFilePath) === "file") {
        return {
            themeName,
            themeDirectoryPath,
            themeFilePath: directoryThemeFilePath,
        };
    }

    throw new Error(`Theme not found: ${themeName}`);
}

function withDeckThemeFrontmatter(markdown, themeName) {
    const normalizedMarkdown = normalizeText(markdown);
    const trimmed = normalizedMarkdown.trim();

    if (!trimmed) {
        return `---\ntheme: ${JSON.stringify(themeName)}\n---\n`;
    }

    if (trimmed.startsWith("---")) {
        const match = normalizedMarkdown.match(/^---\n([\s\S]*?)\n---\n?/);
        if (match && isDeckFrontmatter(match[1])) {
            const nextFrontmatter = upsertTopLevelKey(match[1].trim(), "theme", themeName);
            return normalizedMarkdown.replace(match[1], nextFrontmatter).replace(/\s*$/, "\n");
        }
    }

    return `---\ntheme: ${JSON.stringify(themeName)}\n---\n\n${trimmed}\n`;
}

function readTopFrontmatter(markdown) {
    const normalizedMarkdown = normalizeText(markdown);
    const trimmed = normalizedMarkdown.trim();
    if (!trimmed.startsWith("---")) {
        return null;
    }

    const match = normalizedMarkdown.match(/^---\n([\s\S]*?)\n---\n?/);
    if (!match) {
        return null;
    }

    return match[1];
}

function isDeckFrontmatter(rawFrontmatter) {
    const parsed = parseYamlObject(rawFrontmatter);
    if (!parsed) {
        return false;
    }

    return Object.keys(parsed).every((key) => FILE_FRONTMATTER_KEYS.has(key));
}

function readThemeNameFromMarkdown(markdown) {
    const frontmatter = readTopFrontmatter(markdown);
    if (!frontmatter) {
        return null;
    }

    const match = frontmatter.match(/^theme\s*:\s*(.+)$/m);
    if (!match) {
        return null;
    }

    const rawValue = match[1].trim().replace(/^['"]|['"]$/g, "");
    return rawValue ? sanitizeThemeName(rawValue.endsWith(".css") ? rawValue.slice(0, -4) : rawValue) : null;
}

export async function injectDeckThemeSource(input, {
    themesRoot = getThemesRoot(),
} = {}) {
    const sourceFiles = Array.isArray(input?.source?.files) ? input.source.files : null;
    if (!sourceFiles || !input?.entry) {
        return input;
    }

    const entryFile = sourceFiles.find((file) => file.path === input.entry && typeof file.content === "string");
    if (!entryFile) {
        return input;
    }

    const themeName = readThemeNameFromMarkdown(entryFile.content);
    if (!themeName) {
        return input;
    }

    const {themeFilePath} = await resolveThemeSource(themeName, {themesRoot});

    const themeWorkPath = `${MARKOS_THEME_WORK_DIRNAME}/${themeName}.css`;
    const existingThemeFile = sourceFiles.find((file) => file.path === themeWorkPath);
    const themeContent = await readFile(themeFilePath, "utf8");

    if (existingThemeFile) {
        existingThemeFile.content = themeContent;
    } else {
        sourceFiles.push({
            path: themeWorkPath,
            content: themeContent,
        });
    }

    return input;
}

export async function applyThemeToDeck({
    themeName,
    deckPath = MARKOS_DEFAULT_DECK_DIR,
    themesRoot = getThemesRoot(),
} = {}) {
    const normalizedThemeName = sanitizeThemeName(themeName);
    const resolvedDeckRoot = resolve(deckPath);

    if (await getPathKind(resolvedDeckRoot) !== "directory") {
        throw new Error(`Deck path must be a directory containing ${MARKOS_DEFAULT_ENTRY}: ${resolvedDeckRoot}`);
    }

    const entryFilePath = join(resolvedDeckRoot, MARKOS_DEFAULT_ENTRY);
    if (await getPathKind(entryFilePath) !== "file") {
        throw new Error(`Deck is missing ${MARKOS_DEFAULT_ENTRY}: ${resolvedDeckRoot}`);
    }

    const {themeDirectoryPath, themeFilePath} = await resolveThemeSource(normalizedThemeName, {themesRoot});

    const targetFilePath = getSiblingCssPath(entryFilePath);
    const currentMarkdown = await readFile(entryFilePath, "utf8");
    await writeFile(entryFilePath, withDeckThemeFrontmatter(currentMarkdown, normalizedThemeName), "utf8");

    if (await getPathKind(targetFilePath) !== "file") {
        await mkdir(dirname(targetFilePath), {recursive: true});
        await writeFile(targetFilePath, "/* Local theme overrides */\n", "utf8");
    }

    return {
        themeName: normalizedThemeName,
        themesRoot: resolve(themesRoot),
        themeDirectoryPath,
        themeFilePath,
        deckRoot: resolvedDeckRoot,
        entryFilePath,
        targetFilePath,
    };
}
