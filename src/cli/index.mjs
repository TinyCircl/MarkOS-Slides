import {watch} from "node:fs";
import {rm} from "node:fs/promises";
import {resolve} from "node:path";
import {
    buildStaticSiteFromInput,
    createLocalProjectInput,
} from "../core/index.mjs";
import {startManifestSiteServer} from "../core/dev-server.mjs";
import {getCliRuntimeOptions, resolveCliPaths} from "../config/index.mjs";

export function parseCliArgs(argv) {
    const [command = "help", ...rest] = argv;
    const options = {
        command,
        entry: "slides.md",
        outDir: null,
        workDir: null,
        base: null,
        host: null,
        port: null,
        projectRoot: null,
        title: "",
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
        if (!arg.startsWith("-") && options.entry === "slides.md") {
            options.entry = arg;
        }
    }

    return options;
}

function printHelp() {
    console.log([
        "MarkOS CLI",
        "",
        "Usage:",
        "  markos build [entry] [--out-dir dist] [--base /] [--project-root dir] [--title name]",
        "  markos dev [entry] [--out-dir .markos-dev] [--base /] [--host 127.0.0.1] [--port 3030]",
        "  markos export [entry]",
        "",
        "Notes:",
        "  export is reserved for future non-web artifacts and is not available yet.",
        "",
        "Examples:",
        "  markos build slides.md",
        "  markos build slides.md --out-dir dist",
        "  markos build talks/intro.md --project-root talks",
        "  markos dev slides.md --port 4000",
    ].join("\n"));
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
}) {
    const input = await createLocalProjectInput({
        entryFilePath,
        projectRoot,
        title,
        ignoredPaths: [outDir, workDir],
    });

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

    try {
        await buildLocalAuthoringSite({
            entryFilePath,
            projectRoot,
            outDir,
            workDir,
            basePath,
            title,
            sourceMode,
        });
    } finally {
        await rm(workDir, {recursive: true, force: true}).catch((err) => {
            if (err?.code !== "ENOENT") console.warn("[markos] cleanup workdir failed:", workDir, err.message);
        });
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

async function runDevCommand(rawOptions) {
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
    } = resolveCliPaths(rawOptions);

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
            await buildLocalAuthoringSite({
                entryFilePath,
                projectRoot,
                outDir,
                workDir,
                basePath,
                title,
                sourceMode,
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
            await rm(workDir, {recursive: true, force: true}).catch(() => {
            });
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

    const watcher = watch(projectRoot, {recursive: true, persistent: true}, (_eventType, filename) => {
        if (stopping) {
            return;
        }
        if (filename) {
            const changedPath = resolve(projectRoot, String(filename));
            if (changedPath.startsWith(outDir) || changedPath.startsWith(workDir)) {
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
    });

    console.log(`entry:   ${entryFilePath}`);
    console.log(`root:    ${projectRoot}`);
    console.log(`outDir:  ${outDir}`);
    console.log(`base:    ${basePath}`);
    console.log(`dev:     ${devServer.url}`);

    const stop = async () => {
        stopping = true;
        if (rebuildTimer) {
            clearTimeout(rebuildTimer);
            rebuildTimer = null;
        }
        watcher.close();
        await devServer.stop();
        await rm(workDir, {recursive: true, force: true}).catch((err) => {
            if (err?.code !== "ENOENT") console.warn("[markos] cleanup workdir failed:", workDir, err.message);
        });
    };

    return {
        ok: true,
        command: "dev",
        entryFilePath,
        projectRoot,
        outDir,
        basePath,
        url: devServer.url,
        stop,
    };
}

export async function runCli(argv) {
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
        return runDevCommand(parsed);
    }

    if (options.command === "export") {
        throw new Error("markos export is not available yet. The CLI currently supports only build and dev while MarkOS remains web-only.");
    }

    throw new Error(`Unsupported command: ${options.command}`);
}
