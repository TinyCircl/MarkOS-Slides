import {mkdir, readFile, writeFile} from "node:fs/promises";
import {basename, dirname, join, relative, resolve} from "node:path";
import {
    MARKOS_DEFAULT_DECK_DIR,
    MARKOS_DEFAULT_ENTRY,
    MARKOS_THEMES_DIRNAME,
    getBundledThemesRoot,
} from "@tinycircl/markos-slides-core/config";
import {
    FILE_FRONTMATTER_KEYS,
    MARKOS_THEME_WORK_DIRNAME,
    getPathKind,
    getSiblingCssPath,
    normalizeText,
    parseYamlObject,
    upsertTopLevelKey,
} from "@tinycircl/markos-slides-core/deck-utils";

export {MARKOS_THEMES_DIRNAME} from "@tinycircl/markos-slides-core/config";

export const MARKOS_THEME_ENTRY_FILENAME = "theme.css";

const THEME_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const THEME_FIXTURE_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const LOCAL_CSS_IMPORT_PATTERN = /@import\s+(?:url\()?['"]([^'"]+)['"]\)?\s*;/g;

function sanitizeThemeName(themeName) {
    const normalizedThemeName = themeName?.trim();
    if (!normalizedThemeName) {
        throw new Error("Theme name is required and may contain only letters, numbers, dot, underscore, and dash.");
    }
    if (/\.css$/i.test(normalizedThemeName)) {
        throw new Error("Theme name must not include the .css suffix. Use the theme folder name, for example \"Clay\".");
    }
    if (!THEME_NAME_PATTERN.test(normalizedThemeName)) {
        throw new Error("Theme name is required and may contain only letters, numbers, dot, underscore, and dash.");
    }
    return normalizedThemeName;
}

function sanitizeThemeFixtureName(fixtureName) {
    const normalizedFixtureName = fixtureName?.trim().replace(/\.md$/i, "");
    if (!normalizedFixtureName || !THEME_FIXTURE_NAME_PATTERN.test(normalizedFixtureName)) {
        throw new Error("Fixture name is required and may contain only letters, numbers, dot, underscore, and dash.");
    }
    return normalizedFixtureName;
}

export function getThemesRoot(rootDir = null) {
    if (!rootDir) {
        return getBundledThemesRoot();
    }

    const resolvedRoot = resolve(rootDir);
    return basename(resolvedRoot) === MARKOS_THEMES_DIRNAME
        ? resolvedRoot
        : join(resolvedRoot, MARKOS_THEMES_DIRNAME);
}

function isLocalCssImport(value) {
    return value && !/^(https?:|data:|blob:|\/)/i.test(value);
}

function toPosixPath(value) {
    return String(value).replaceAll("\\", "/");
}

function isWithinDirectory(rootDir, targetPath) {
    const normalizedRoot = resolve(rootDir);
    const normalizedTarget = resolve(targetPath);
    const relativePath = relative(normalizedRoot, normalizedTarget);
    return relativePath === ""
        || (!relativePath.startsWith("..") && !relativePath.includes(":"));
}

export async function resolveThemeSource(themeName, {
    themesRoot = getThemesRoot(),
} = {}) {
    const normalizedThemeName = sanitizeThemeName(themeName);
    const resolvedThemesRoot = resolve(themesRoot);
    const themeDirectoryPath = join(resolvedThemesRoot, normalizedThemeName);
    const themeFilePath = join(themeDirectoryPath, MARKOS_THEME_ENTRY_FILENAME);

    if (await getPathKind(themeFilePath) === "file") {
        return {
            themeName: normalizedThemeName,
            themeDirectoryPath,
            themeFilePath,
        };
    }

    throw new Error(`Theme not found: ${normalizedThemeName}`);
}

export async function resolveThemeFixtureSource(themeName, fixtureName, {
    themesRoot = getThemesRoot(),
} = {}) {
    const normalizedFixtureName = sanitizeThemeFixtureName(fixtureName);
    const themeSource = await resolveThemeSource(themeName, {themesRoot});
    const fixtureFilePath = join(themeSource.themeDirectoryPath, "fixtures", `${normalizedFixtureName}.md`);

    if (await getPathKind(fixtureFilePath) !== "file") {
        throw new Error(`Theme fixture not found: ${themeSource.themeName}/${normalizedFixtureName}`);
    }

    return {
        ...themeSource,
        fixtureName: normalizedFixtureName,
        fixtureFilePath,
    };
}

async function collectThemeSourceFiles(filePath, {
    themeName,
    themeDirectoryPath,
    seen = new Set(),
} = {}) {
    const normalizedFilePath = resolve(filePath);
    if (seen.has(normalizedFilePath)) {
        return [];
    }
    seen.add(normalizedFilePath);

    const content = await readFile(normalizedFilePath, "utf8");
    const relativeThemePath = toPosixPath(relative(themeDirectoryPath, normalizedFilePath));
    const workPath = relativeThemePath === MARKOS_THEME_ENTRY_FILENAME
        ? `${MARKOS_THEME_WORK_DIRNAME}/${themeName}.css`
        : `${MARKOS_THEME_WORK_DIRNAME}/${relativeThemePath}`;
    const files = [{path: workPath, content}];

    for (const match of content.matchAll(LOCAL_CSS_IMPORT_PATTERN)) {
        const importTarget = match[1];
        if (!isLocalCssImport(importTarget)) {
            continue;
        }

        const importedFilePath = resolve(dirname(normalizedFilePath), importTarget);
        if (!isWithinDirectory(themeDirectoryPath, importedFilePath)) {
            throw new Error(`Theme import must stay inside the theme directory: ${importTarget}`);
        }

        files.push(...await collectThemeSourceFiles(importedFilePath, {
            themeName,
            themeDirectoryPath,
            seen,
        }));
    }

    return files;
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
    return rawValue ? sanitizeThemeName(rawValue) : null;
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

    const {themeDirectoryPath, themeFilePath} = await resolveThemeSource(themeName, {themesRoot});
    const themeSourceFiles = await collectThemeSourceFiles(themeFilePath, {
        themeName,
        themeDirectoryPath,
    });

    for (const themeSourceFile of themeSourceFiles) {
        const existingThemeFile = sourceFiles.find((file) => file.path === themeSourceFile.path);
        if (existingThemeFile) {
            existingThemeFile.content = themeSourceFile.content;
        } else {
            sourceFiles.push(themeSourceFile);
        }
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
