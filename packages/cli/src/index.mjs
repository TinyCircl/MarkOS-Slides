import {spawn} from "node:child_process";
import {watch} from "node:fs";
import {mkdir, mkdtemp, readFile, rm, writeFile} from "node:fs/promises";
import os from "node:os";
import {basename, dirname, join, resolve} from "node:path";
import {
    buildArtifactFromInput,
    buildRenderOutputMetadata,
    buildStaticSiteFromInput,
    createLocalProjectInput,
} from "@tinycircl/markos-slides-core";
import {startManifestSiteServer} from "@tinycircl/markos-slides-core/dev-server";
import {
    MARKOS_DEFAULT_BUILD_OUT_DIRNAME,
    MARKOS_DEFAULT_DECK_DIR,
    MARKOS_DEFAULT_ENTRY,
    MARKOS_DEFAULT_WORK_ROOT_DIRNAME,
    getCliRuntimeOptions,
    resolveCliPaths,
} from "@tinycircl/markos-slides-core/config";
import {getPathKind, isPathWithin} from "@tinycircl/markos-slides-core/deck-utils";
import {applyThemeToDeck, getThemesRoot, injectDeckThemeSource, resolveThemeFixtureSource} from "./theme.mjs";

export function parseCliArgs(argv) {
    const [command = "help", ...rest] = argv;
    const options = {
        command,
        entry: MARKOS_DEFAULT_DECK_DIR,
        outDir: null,
        workDir: null,
        base: null,
        host: null,
        port: null,
        projectRoot: null,
        title: "",
        open: null,
        format: "",
        fileName: "",
    };

    for (let index = 0; index < rest.length; index += 1) {
        const arg = rest[index];
        const next = rest[index + 1];

        if (arg === "--out-dir" && next) {
            options.outDir = next;
            index += 1;
            continue;
        }
        if (arg === "--work-dir" && next) {
            options.workDir = next;
            index += 1;
            continue;
        }
        if (arg === "--base" && next) {
            options.base = next;
            index += 1;
            continue;
        }
        if (arg === "--project-root" && next) {
            options.projectRoot = next;
            index += 1;
            continue;
        }
        if (arg === "--host" && next) {
            options.host = next;
            index += 1;
            continue;
        }
        if (arg === "--port" && next) {
            options.port = Number(next);
            index += 1;
            continue;
        }
        if (arg === "--title" && next) {
            options.title = next;
            index += 1;
            continue;
        }
        if (arg === "--format" && next) {
            options.format = next;
            index += 1;
            continue;
        }
        if (arg === "--file-name" && next) {
            options.fileName = next;
            index += 1;
            continue;
        }
        if (arg === "--open") {
            options.open = true;
            continue;
        }
        if (arg === "--no-open") {
            options.open = false;
            continue;
        }
        if (!arg.startsWith("-") && options.entry === MARKOS_DEFAULT_DECK_DIR) {
            options.entry = arg;
        }
    }

    return options;
}

export function openUrlInBrowser(url) {
    return new Promise((resolvePromise, rejectPromise) => {
        let command = "";
        let args = [];

        if (process.platform === "darwin") {
            command = "open";
            args = [url];
        } else if (process.platform === "win32") {
            command = "cmd";
            args = ["/c", "start", "", url];
        } else {
            command = "xdg-open";
            args = [url];
        }

        const child = spawn(command, args, {
            detached: true,
            stdio: "ignore",
            windowsHide: true,
        });

        child.once("error", rejectPromise);
        child.once("spawn", () => {
            child.unref();
            resolvePromise();
        });
    });
}

async function cleanupWorkDir(workDir) {
    await rm(workDir, {recursive: true, force: true}).catch((err) => {
        if (err?.code !== "ENOENT") console.warn("[markos] cleanup workdir failed:", workDir, err.message);
    });

    const workRootDir = dirname(workDir);
    if (basename(workRootDir) !== MARKOS_DEFAULT_WORK_ROOT_DIRNAME) {
        return;
    }

    await rm(workRootDir, {recursive: true, force: true}).catch((err) => {
        if (err?.code !== "ENOENT") console.warn("[markos] cleanup work root failed:", workRootDir, err.message);
    });
}

function printHelp() {
    console.log([
        "MarkOS CLI",
        "",
        "Usage:",
        "  markos build [deck] [--out-dir dist] [--base /] [--project-root dir] [--title name]",
        "  markos dev [deck] [--out-dir .markos-dev] [--base /] [--host 127.0.0.1] [--port 3030] [--no-open]",
        "  markos theme apply <theme> [deck]",
        "  markos theme preview <theme> <fixture> [--host 127.0.0.1] [--port 3030] [--no-open]",
        "  markos export [deck] [--format pdf] [--out-dir dist] [--file-name name]",
        "",
        "Notes:",
        "  deck must be a directory containing slides.md.",
        `  theme apply writes theme: <theme> into slides.md and keeps slides.css for local overrides.`,
        "  theme preview renders packages/core/themes/<theme>/fixtures/<fixture>.md through the real MarkOS dev pipeline.",
        "  export currently supports pdf.",
        "",
        "Examples:",
        "  markos build .",
        "  markos build examples/tokyo3days",
        "  markos build talks/intro --out-dir dist",
        "  markos dev examples/tokyo3days --port 4000",
        "  markos dev examples/tokyo3days",
        "  markos dev examples/tokyo3days --no-open",
        "  markos theme apply Clay examples/tokyo3days",
        "  markos theme preview Cobalt comparison --port 3030",
        "  markos export examples/tokyo3days --format pdf",
    ].join("\n"));
}

function parseThemePreviewArgs(argv) {
    const [themeName = "", fixtureName = "", ...rest] = argv;
    const parsed = parseCliArgs(["dev", MARKOS_DEFAULT_DECK_DIR, ...rest]);
    return {
        ...parsed,
        themeName,
        fixtureName,
    };
}

async function runThemePreviewCommand(argv, runtime = {}) {
    const parsed = parseThemePreviewArgs(argv);
    const themesRoot = getThemesRoot(null);
    const {
        themeName,
        fixtureName,
        themeDirectoryPath,
        themeFilePath,
        fixtureFilePath,
    } = await resolveThemeFixtureSource(parsed.themeName, parsed.fixtureName, {themesRoot});

    const previewRoot = await mkdtemp(resolve(join(os.tmpdir(), "markos-theme-preview-")));
    const previewDeckRoot = resolve(join(previewRoot, themeName, fixtureName));
    const syncFixtureDeck = async () => {
        await mkdir(previewDeckRoot, {recursive: true});
        const markdown = await readFile(fixtureFilePath, "utf8");
        await writeFile(resolve(join(previewDeckRoot, MARKOS_DEFAULT_ENTRY)), markdown, "utf8");
    };

    try {
        await syncFixtureDeck();
        const devResult = await runDevCommand({
            ...parsed,
            command: "dev",
            entry: previewDeckRoot,
        }, {
            openUrl: runtime.openUrlInBrowser,
            beforeRebuild: syncFixtureDeck,
            watchRoots: [themeDirectoryPath],
            resultCommand: "theme-preview",
        });

        console.log(`theme:   ${themeName}`);
        console.log(`fixture: ${fixtureName}`);
        console.log(`source:  ${fixtureFilePath}`);

        const stop = async () => {
            await devResult.stop?.();
            await rm(previewRoot, {recursive: true, force: true}).catch(() => {
            });
        };

        return {
            ...devResult,
            command: "theme",
            action: "preview",
            themeName,
            fixtureName,
            themeDirectoryPath,
            themeFilePath,
            fixtureFilePath,
            previewDeckRoot,
            stop,
        };
    } catch (error) {
        await rm(previewRoot, {recursive: true, force: true}).catch(() => {
        });
        throw error;
    }
}

async function runThemeCommand(argv, runtime = {}) {
    const [action = "", themeName = "", deckPath = MARKOS_DEFAULT_DECK_DIR] = argv;

    if (action === "help" || action === "--help" || action === "-h" || !action) {
        printHelp();
        return {ok: true, command: "theme", action: "help"};
    }

    if (action === "apply") {
        const result = await applyThemeToDeck({
            themeName,
            deckPath,
        });

        console.log(`theme:   ${result.themeName}`);
        console.log(`source:  ${result.themeFilePath}`);
        console.log(`deck:    ${result.deckRoot}`);
        console.log(`target:  ${result.targetFilePath}`);

        return {
            ok: true,
            command: "theme",
            action: "apply",
            ...result,
        };
    }

    if (action === "preview") {
        return runThemePreviewCommand(argv.slice(1), runtime);
    }

    throw new Error(`Unsupported theme command: ${action}`);
}

async function buildLocalAuthoringSite({
    entryFilePath,
    projectRoot,
    outDir,
    workDir,
    basePath,
    title,
    sourceMode,
    manifest = null,
    themesRoot = getThemesRoot(null),
}) {
    const input = await createLocalProjectInput({
        entryFilePath,
        projectRoot,
        title,
        ignoredPaths: [outDir, workDir],
    });
    await injectDeckThemeSource(input, {themesRoot});

    await buildStaticSiteFromInput({
        input,
        mode: sourceMode,
        outputDir: outDir,
        workDir,
        basePath,
        manifest,
    });
}

async function runBuildCommand(rawOptions) {
    const {
        entryFilePath,
        projectRoot,
        outDir,
        workDir,
        basePath,
        title,
        sourceMode,
    } = resolveCliPaths(rawOptions);
    const themesRoot = getThemesRoot(null);

    try {
        await buildLocalAuthoringSite({
            entryFilePath,
            projectRoot,
            outDir,
            workDir,
            basePath,
            title,
            sourceMode,
            themesRoot,
        });
    } finally {
        await cleanupWorkDir(workDir);
    }

    console.log(`entry:   ${entryFilePath}`);
    console.log(`root:    ${projectRoot}`);
    console.log(`outDir:  ${outDir}`);
    console.log(`base:    ${basePath}`);

    return {
        ok: true,
        command: "build",
        entryFilePath,
        projectRoot,
        outDir,
        basePath,
    };
}

async function runExportCommand(rawOptions) {
    const format = String(rawOptions.format || "pdf").trim().toLowerCase() || "pdf";
    if (format !== "pdf") {
        throw new Error(`markos export currently supports only pdf. Received: ${format}`);
    }

    const {
        entryFilePath,
        projectRoot,
        outDir,
        workDir,
        title,
        sourceMode,
    } = resolveCliPaths(rawOptions);
    const themesRoot = getThemesRoot(null);
    const input = await createLocalProjectInput({
        entryFilePath,
        projectRoot,
        title,
        ignoredPaths: [outDir, workDir],
    });
    await injectDeckThemeSource(input, {themesRoot});

    const requestedBaseName = String(rawOptions.fileName || "").trim();
    const outputFileName = requestedBaseName
        ? (requestedBaseName.toLowerCase().endsWith(".pdf") ? requestedBaseName : `${requestedBaseName}.pdf`)
        : buildRenderOutputMetadata({
            ...input,
            format,
        }).outputFileName;

    let artifact = null;
    try {
        artifact = await buildArtifactFromInput({
            input,
            mode: sourceMode,
            artifactDir: outDir,
            workDir,
            format,
            outputFileName,
        });
    } finally {
        await cleanupWorkDir(workDir);
    }

    console.log(`entry:   ${entryFilePath}`);
    console.log(`root:    ${projectRoot}`);
    console.log(`format:  ${artifact.format}`);
    console.log(`outDir:  ${outDir}`);
    console.log(`file:    ${artifact.artifactFilePath}`);

    return {
        ok: true,
        command: "export",
        entryFilePath,
        projectRoot,
        outDir,
        artifactFilePath: artifact.artifactFilePath,
        fileName: artifact.fileName,
        format: artifact.format,
    };
}

async function runDevCommand(rawOptions, {
    openUrl = openUrlInBrowser,
    beforeRebuild = null,
    watchRoots: explicitWatchRoots = null,
    resultCommand = "dev",
} = {}) {
    const {
        entryFilePath,
        projectRoot,
        outDir,
        workDir,
        basePath,
        host,
        port,
        title,
        sourceMode,
        open,
    } = resolveCliPaths(rawOptions);
    const themesRoot = getThemesRoot(null);
    const defaultBuildOutDir = resolve(projectRoot, MARKOS_DEFAULT_BUILD_OUT_DIRNAME);
    const ignoredWatchRoots = [
        outDir,
        workDir,
        dirname(workDir),
        defaultBuildOutDir,
    ];

    let rebuildTimer = null;
    let rebuilding = false;
    let rebuildQueued = false;
    let stopping = false;

    async function rebuild(reason) {
        if (stopping) {
            return;
        }
        if (rebuilding) {
            rebuildQueued = true;
            return;
        }

        rebuilding = true;
        try {
            if (beforeRebuild) {
                await beforeRebuild();
            }
            await buildLocalAuthoringSite({
                entryFilePath,
                projectRoot,
                outDir,
                workDir,
                basePath,
                title,
                sourceMode,
                themesRoot,
                manifest: {
                    previewId: "local-dev",
                    buildId: `${Date.now()}`,
                },
            });
            console.log(`[markos] rebuilt (${reason})`);
        } catch (error) {
            console.error(`[markos] rebuild failed (${reason})`);
            console.error(error.message || String(error));
        } finally {
            rebuilding = false;
            await cleanupWorkDir(workDir);
            if (rebuildQueued && !stopping) {
                rebuildQueued = false;
                void rebuild("queued change");
            }
        }
    }

    await rebuild("startup");
    const devServer = await startManifestSiteServer({
        rootDir: outDir,
        basePath,
        host,
        port,
    });

    const watchRoots = explicitWatchRoots?.length
        ? [...new Set(explicitWatchRoots.map((rootPath) => resolve(rootPath)))]
        : [projectRoot];
    if (
        !explicitWatchRoots
        && await getPathKind(themesRoot) === "directory"
        && !watchRoots.some((rootPath) => isPathWithin(rootPath, themesRoot) || isPathWithin(themesRoot, rootPath))
    ) {
        watchRoots.push(themesRoot);
    }

    const handleWatchEvent = (watchRoot, _eventType, filename) => {
        if (stopping) {
            return;
        }
        if (filename) {
            const changedPath = resolve(watchRoot, String(filename));
            if (ignoredWatchRoots.some((rootPath) => isPathWithin(rootPath, changedPath))) {
                return;
            }
        }
        if (rebuildTimer) {
            clearTimeout(rebuildTimer);
        }
        rebuildTimer = setTimeout(() => {
            rebuildTimer = null;
            void rebuild("file change");
        }, 200);
    };
    const watchers = watchRoots.map((watchRoot) => watch(
        watchRoot,
        {recursive: true, persistent: true},
        (eventType, filename) => handleWatchEvent(watchRoot, eventType, filename),
    ));

    console.log(`entry:   ${entryFilePath}`);
    console.log(`root:    ${projectRoot}`);
    console.log(`outDir:  ${outDir}`);
    console.log(`base:    ${basePath}`);
    console.log(`dev:     ${devServer.url}`);

    if (open !== false) {
        await openUrl(devServer.url).catch((error) => {
            console.warn(`[markos] failed to open browser: ${error.message || String(error)}`);
        });
    }

    const stop = async () => {
        stopping = true;
        if (rebuildTimer) {
            clearTimeout(rebuildTimer);
            rebuildTimer = null;
        }
        for (const watcher of watchers) {
            watcher.close();
        }
        await devServer.stop();
        await cleanupWorkDir(workDir);
    };

    return {
        ok: true,
        command: resultCommand,
        entryFilePath,
        projectRoot,
        outDir,
        basePath,
        url: devServer.url,
        stop,
    };
}

export async function runCli(argv, runtime = {}) {
    const [command = "help"] = argv;
    if (command === "theme") {
        return runThemeCommand(argv.slice(1), runtime);
    }

    const parsed = parseCliArgs(argv);
    const options = getCliRuntimeOptions(parsed);

    if (options.command === "help" || options.command === "--help" || options.command === "-h") {
        printHelp();
        return {ok: true, command: "help"};
    }

    if (options.command === "build") {
        return runBuildCommand(parsed);
    }

    if (options.command === "dev") {
        return runDevCommand(parsed, {openUrl: runtime.openUrlInBrowser});
    }

    if (options.command === "export") {
        return runExportCommand(parsed);
    }

    throw new Error(`Unsupported command: ${options.command}`);
}
