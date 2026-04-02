import {watch} from "node:fs";
import path from "node:path";
import {parseArgs, runPreviewRequest} from "./preview-local-file.mjs";

function timestamp() {
    return new Date().toLocaleTimeString("zh-CN", {hour12: false});
}

async function main() {
    const options = parseArgs(process.argv.slice(2));
    const watchedFile = path.resolve(options.file);
    const watchedDir = path.dirname(watchedFile);
    const watchedName = path.basename(watchedFile);

    let debounceTimer = null;
    let running = false;
    let rerunRequested = false;

    async function triggerBuild(reason) {
        if (running) {
            rerunRequested = true;
            return;
        }

        running = true;
        console.log(`[${timestamp()}] rebuild start (${reason})`);
        try {
            await runPreviewRequest(options);
            console.log(`[${timestamp()}] rebuild done`);
        } catch (error) {
            console.error(`[${timestamp()}] rebuild failed`);
            console.error(error.message || String(error));
        } finally {
            running = false;
            if (rerunRequested) {
                rerunRequested = false;
                void triggerBuild("queued change");
            }
        }
    }

    function scheduleBuild(reason) {
        if (debounceTimer) {
            clearTimeout(debounceTimer);
        }
        debounceTimer = setTimeout(() => {
            debounceTimer = null;
            void triggerBuild(reason);
        }, 250);
    }

    console.log(`[${timestamp()}] watching ${watchedFile}`);
    console.log(`[${timestamp()}] host ${options.host}`);
    await triggerBuild("startup");

    const watcher = watch(watchedDir, {persistent: true}, (_eventType, filename) => {
        if (!filename) {
            return;
        }
        const normalized = String(filename).replace(/\\/g, "/");
        if (normalized === watchedName || normalized.endsWith(`/${watchedName}`)) {
            scheduleBuild("file change");
        }
    });

    process.on("SIGINT", () => {
        watcher.close();
        process.exit(0);
    });
}

main().catch((error) => {
    console.error(error.message || String(error));
    process.exitCode = 1;
});
