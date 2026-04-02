import {readFile, readdir, stat} from "node:fs/promises";
import http from "node:http";
import https from "node:https";
import path from "node:path";
import {fileURLToPath} from "node:url";

export function parseArgs(argv) {
    const options = {
        api: "build",
        host: "http://127.0.0.1:3210",
        file: path.join(process.cwd(), "slides.md"),
        previewId: "local-old-preview",
        title: "",
        json: false,
    };

    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        const next = argv[index + 1];

        if (arg === "--api" && next) {
            options.api = next;
            index += 1;
            continue;
        }
        if (arg === "--host" && next) {
            options.host = next.replace(/\/+$/, "");
            index += 1;
            continue;
        }
        if (arg === "--file" && next) {
            options.file = path.resolve(next);
            index += 1;
            continue;
        }
        if (arg === "--preview-id" && next) {
            options.previewId = next;
            index += 1;
            continue;
        }
        if (arg === "--title" && next) {
            options.title = next;
            index += 1;
            continue;
        }
        if (arg === "--json") {
            options.json = true;
        }
    }

    return options;
}

async function pathExists(targetPath) {
    try {
        await stat(targetPath);
        return true;
    } catch {
        return false;
    }
}

async function listFilesRecursive(rootDir, currentDir = rootDir) {
    const entries = await readdir(currentDir, {withFileTypes: true});
    const files = [];

    for (const entry of entries) {
        const absolutePath = path.join(currentDir, entry.name);
        if (entry.isDirectory()) {
            files.push(...await listFilesRecursive(rootDir, absolutePath));
            continue;
        }
        if (!entry.isFile()) {
            continue;
        }
        files.push({
            absolutePath,
            relativePath: path.relative(rootDir, absolutePath).replace(/\\/g, "/"),
        });
    }

    return files;
}

export async function buildSourceFiles(markdownPath) {
    const directory = path.dirname(markdownPath);
    const markdown = await readFile(markdownPath, "utf8");
    const sourceFiles = [
        {
            path: "slides.md",
            content: markdown,
        },
    ];

    const siblingCssPath = path.join(directory, "index.css");
    if (await pathExists(siblingCssPath)) {
        sourceFiles.push({
            path: "styles/index.css",
            content: await readFile(siblingCssPath, "utf8"),
        });
    }

    const siblingAssetsDir = path.join(directory, "assets");
    if (await pathExists(siblingAssetsDir)) {
        const assetFiles = await listFilesRecursive(siblingAssetsDir);
        for (const file of assetFiles) {
            const buffer = await readFile(file.absolutePath);
            sourceFiles.push({
                path: `assets/${file.relativePath}`,
                contentBase64: buffer.toString("base64"),
            });
        }
    }

    return {
        markdown,
        sourceFiles,
    };
}

export async function postJson(url, body) {
    const target = new URL(url);
    const client = target.protocol === "https:" ? https : http;
    const payload = JSON.stringify(body);

    return await new Promise((resolve, reject) => {
        const request = client.request({
            protocol: target.protocol,
            hostname: target.hostname,
            port: target.port,
            path: `${target.pathname}${target.search}`,
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(payload),
            },
        }, (response) => {
            let text = "";
            response.setEncoding("utf8");
            response.on("data", (chunk) => {
                text += chunk;
            });
            response.on("end", () => {
                let parsed;
                try {
                    parsed = text ? JSON.parse(text) : null;
                } catch {
                    parsed = text;
                }

                if ((response.statusCode ?? 500) >= 400) {
                    const detail = typeof parsed === "string" ? parsed : JSON.stringify(parsed, null, 2);
                    reject(new Error(`Request failed with ${response.statusCode} ${response.statusMessage}\n${detail}`));
                    return;
                }

                resolve(parsed);
            });
        });

        request.on("error", (error) => {
            reject(new Error(`Failed to connect to ${url}\n${error.message}`));
        });

        request.write(payload);
        request.end();
    });
}

export function printHumanSummary(api, response) {
    if (api === "session") {
        console.log(`sessionId: ${response.sessionId}`);
        console.log(`slides:    ${response.slidesUrl}`);
        console.log(`overview:  ${response.overviewUrl}`);
        console.log(`presenter: ${response.presenterUrl}`);
        return;
    }

    console.log(`previewId: ${response.previewId}`);
    console.log(`preview:   ${response.previewUrl}`);
    console.log(`cacheHit:  ${response.cacheHit}`);
    if (response.timings) {
        console.log(`buildMs:   ${response.timings.buildMs}`);
    }
}

export async function runPreviewRequest(options) {
    const {markdown, sourceFiles} = await buildSourceFiles(options.file);
    const title = options.title || path.basename(options.file, path.extname(options.file));

    if (options.api === "session") {
        if (sourceFiles.length > 1) {
            console.warn("preview/session currently only sends markdown content; sibling index.css and assets are ignored in session mode.");
        }
        const response = await postJson(`${options.host}/api/preview/session`, {
            title,
            content: markdown,
        });
        if (options.json) {
            console.log(JSON.stringify(response, null, 2));
            return response;
        }
        printHumanSummary("session", response);
        return response;
    }

    if (options.api !== "build") {
        throw new Error(`Unsupported --api value: ${options.api}. Use "build" or "session".`);
    }

    const response = await postJson(`${options.host}/api/previews/build`, {
        previewId: options.previewId,
        basePath: `/p/${options.previewId}/`,
        title,
        entry: "slides.md",
        source: {
            files: sourceFiles,
        },
    });

    if (options.json) {
        console.log(JSON.stringify(response, null, 2));
        return response;
    }
    printHumanSummary("build", response);
    return response;
}

async function main() {
    const options = parseArgs(process.argv.slice(2));
    await runPreviewRequest(options);
}

const currentFilePath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === currentFilePath) {
    main().catch((error) => {
        console.error(error.message || String(error));
        process.exitCode = 1;
    });
}
