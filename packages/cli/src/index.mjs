import {watch} from "node:fs";
import {rm} from "node:fs/promises";
import {basename, dirname, resolve} from "node:path";
import {
    buildStaticSiteFromInput,
    createLocalProjectInput,
} from "@tinycircl/markos-slides-core";
import {startManifestSiteServer} from "@tinycircl/markos-slides-core/dev-server";
import {
    MARKOS_DEFAULT_BUILD_OUT_DIRNAME,
    MARKOS_DEFAULT_WORK_ROOT_DIRNAME,
    getCliRuntimeOptions,
    resolveCliPaths,
} from "@tinycircl/markos-slides-core/config";

export function parseCliArgs(argv) {
    const [command = "help", ...rest] = argv;
    const options = {
        command,
        entry: ".",
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
        if (!arg.startsWith("-") && options.entry === ".") {
            options.entry = arg;
        }
    }

    return options;
}

function isSamePathOrInside(parentPath, targetPath) {
    const normalizedParent = resolve(parentPath);
    const normalizedTarget = resolve(targetPath);
    return normalizedTarget === normalizedParent
        || normalizedTarget.startsWith(`${normalizedParent}\\`)
        || normalizedTarget.startsWith(`${normalizedParent}/`);
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
        "  markos dev [deck] [--out-dir .markos-dev] [--base /] [--host 127.0.0.1] [--port 3030]",
        "  markos export [deck]",
        "",
        "Notes:",
        "  deck must be a directory containing slides.md.",
        "  export is reserved for future non-web artifacts and is not available yet.",
        "",
        "Examples:",
        "  markos build .",
        "  markos build examples/project",
        "  markos build talks/intro --out-dir dist",
        "  markos dev examples/project --port 4000",
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

    const watcher = watch(projectRoot, {recursive: true, persistent: true}, (_eventType, filename) => {
        if (stopping) {
            return;
        }
        if (filename) {
            const changedPath = resolve(projectRoot, String(filename));
            if (ignoredWatchRoots.some((rootPath) => isSamePathOrInside(rootPath, changedPath))) {
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
        await cleanupWorkDir(workDir);
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
