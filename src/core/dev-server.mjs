import http from "node:http";
import {readFile} from "node:fs/promises";
import {
    MARKOS_DEFAULT_BASE_PATH,
    MARKOS_DEFAULT_DEV_HOST,
    MARKOS_DEFAULT_DEV_PORT,
} from "../config/index.mjs";
import {resolveManifestSiteRequest} from "./manifest-site.mjs";

function getErrorBody(reason) {
    switch (reason) {
        case "missing_manifest":
            return "Site not built yet";
        case "forbidden":
            return "Forbidden";
        case "invalid_path":
            return "Invalid path";
        case "asset_not_found":
            return "Asset Not Found";
        case "invalid_entry":
            return "Invalid entry file";
        case "entry_missing":
            return "Entry file not found";
        default:
            return "Not Found";
    }
}

function getDisplayHost(host) {
    return host === "0.0.0.0" ? "127.0.0.1" : host;
}

export async function startManifestSiteServer({
    rootDir,
    basePath = MARKOS_DEFAULT_BASE_PATH,
    host = MARKOS_DEFAULT_DEV_HOST,
    port = MARKOS_DEFAULT_DEV_PORT,
} = {}) {
    if (!rootDir) {
        throw new Error("rootDir is required.");
    }

    const server = http.createServer(async (req, res) => {
        try {
            if (req.method !== "GET" && req.method !== "HEAD") {
                res.writeHead(405, {
                    "content-type": "text/plain; charset=utf-8",
                    "allow": "GET, HEAD",
                });
                res.end("Method Not Allowed");
                return;
            }

            const pathname = decodeURIComponent(new URL(req.url || "/", `http://${req.headers.host || "localhost"}`).pathname);
            const resolved = await resolveManifestSiteRequest({
                rootDir,
                basePrefix: basePath,
                requestPathname: pathname,
            });

            if (resolved.type === "redirect") {
                res.writeHead(resolved.status, {location: resolved.location});
                res.end();
                return;
            }

            if (resolved.type === "error") {
                res.writeHead(resolved.status, {"content-type": "text/plain; charset=utf-8"});
                res.end(getErrorBody(resolved.reason));
                return;
            }

            const body = req.method === "HEAD"
                ? null
                : await readFile(resolved.absoluteFilePath);
            res.writeHead(resolved.status, {
                "content-type": resolved.contentType,
                "cache-control": "no-store",
            });
            res.end(body);
        } catch (error) {
            res.writeHead(500, {"content-type": "text/plain; charset=utf-8"});
            res.end(error instanceof Error ? error.message : "Internal Server Error");
        }
    });

    await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(port, host, () => {
            server.off("error", reject);
            resolve();
        });
    });

    const address = server.address();
    const resolvedPort = typeof address === "object" && address ? address.port : port;
    const url = `http://${getDisplayHost(host)}:${resolvedPort}${basePath}`;

    return {
        server,
        host,
        port: resolvedPort,
        url,
        async stop() {
            await new Promise((resolve, reject) => {
                server.close((error) => {
                    if (error) {
                        reject(error);
                        return;
                    }
                    resolve();
                });
            });
        },
    };
}
