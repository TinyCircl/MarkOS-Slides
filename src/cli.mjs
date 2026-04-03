#!/usr/bin/env node

import {resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {runCli} from "../packages/cli/index.mjs";

export {parseCliArgs, runCli} from "../packages/cli/index.mjs";

const currentFilePath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === currentFilePath) {
    runCli(process.argv.slice(2)).then((result) => {
        if (!result?.stop) {
            return;
        }

        const shutdown = async () => {
            await result.stop().catch((err) => {
                console.warn("[markos] shutdown error:", err.message);
            });
            process.exit(0);
        };

        process.once("SIGINT", () => {
            void shutdown();
        });
        process.once("SIGTERM", () => {
            void shutdown();
        });
    }).catch((error) => {
        console.error(error.message || String(error));
        process.exitCode = 1;
    });
}
