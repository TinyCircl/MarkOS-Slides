import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import grpc from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";
import {
    buildPreviewSite,
    getCachedPreviewPublishResult,
    renderArtifact,
    updateCachedPreviewPublishResult,
} from "./render-manager.mjs";
import { isR2Configured, publishPreviewSiteToR2 } from "./r2-client.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROTO_PATH = join(__dirname, "slidev_service.proto");
const GRPC_PORT = Number(process.env.GRPC_PORT || 50051);
const PUBLIC_BASE_URL = process.env.SLIDEV_PUBLIC_BASE_URL?.replace(/\/$/, "") || null;
const PREVIEW_SITE_BASE_URL = process.env.SLIDEV_PREVIEW_SITE_BASE_URL?.replace(/\/$/, "") || null;

const RENDER_FORMAT_MAP = {
    0: "web",
    1: "pdf",
    2: "pptx",
    RENDER_FORMAT_WEB: "web",
    RENDER_FORMAT_PDF: "pdf",
    RENDER_FORMAT_PPTX: "pptx",
};

function getLocalPreviewUrl(previewId) {
    const base = PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 3210}`;
    return `${base}/p/${encodeURIComponent(previewId)}/`;
}

function getPublishedPreviewUrl(previewId) {
    if (!PREVIEW_SITE_BASE_URL) {
        return "";
    }
    return new URL(`/p/${encodeURIComponent(previewId)}/`, `${PREVIEW_SITE_BASE_URL}/`).toString();
}

async function buildPreviewHandler(call, callback) {
    const req = call.request;
    const requestStartedAt = Date.now();
    console.log(`[gRPC] BuildPreview: previewId=${req.previewId}, contentLen=${req.content?.length ?? 0}, publish=${req.publish}`);

    try {
        const buildStartedAt = Date.now();
        const preview = await buildPreviewSite({
            previewId: req.previewId,
            content: req.content,
            title: req.title || undefined,
            basePath: req.basePath || undefined,
            publish: false,
        });
        const buildDurationMs = Date.now() - buildStartedAt;
        console.log(`[gRPC] BuildPreview done: previewId=${preview.previewId}, buildId=${preview.buildId}, cacheHit=${preview.cacheHit}, buildMs=${buildDurationMs}`);

        let publishDurationMs = 0;
        let publishedPreviewUrl = "";

        if (req.publish && isR2Configured()) {
            const publishStartedAt = Date.now();
            let publishResult = null;

            if (preview.cacheHit) {
                publishResult = await getCachedPreviewPublishResult({
                    previewId: preview.previewId,
                    buildId: preview.buildId,
                });
            }

            if (!publishResult) {
                publishResult = await publishPreviewSiteToR2({
                    previewId: preview.previewId,
                    outputDir: preview.outputDir,
                });
                await updateCachedPreviewPublishResult({
                    previewId: preview.previewId,
                    buildId: preview.buildId,
                    publishResult,
                });
            }

            publishDurationMs = Date.now() - publishStartedAt;
            publishedPreviewUrl = getPublishedPreviewUrl(preview.previewId);
        }

        callback(null, {
            previewId: preview.previewId,
            buildId: preview.buildId,
            sourceHash: preview.sourceHash ?? "",
            cacheHit: preview.cacheHit === true,
            localPreviewUrl: getLocalPreviewUrl(preview.previewId),
            publishedPreviewUrl: publishedPreviewUrl,
            timings: {
                totalMs: Date.now() - requestStartedAt,
                buildMs: buildDurationMs,
                publishMs: publishDurationMs,
            },
        });
    } catch (error) {
        console.error(`[gRPC] BuildPreview error: previewId=${req.previewId}, err=${error instanceof Error ? error.message : error}`);
        callback({
            code: grpc.status.INTERNAL,
            message: error instanceof Error ? error.message : "Failed to build Slidev preview.",
        });
    }
}

async function renderArtifactHandler(call, callback) {
    const req = call.request;
    const format = RENDER_FORMAT_MAP[req.format] ?? "web";
    const base = PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 3210}`;
    console.log(`[gRPC] RenderArtifact: format=${format}, contentLen=${req.content?.length ?? 0}`);
    const startedAt = Date.now();

    try {
        const artifact = await renderArtifact({
            content: req.content,
            title: req.title || undefined,
            format,
            fileName: req.fileName || undefined,
        });

        console.log(`[gRPC] RenderArtifact done: jobId=${artifact.jobId}, format=${artifact.format}, costMs=${Date.now() - startedAt}`);
        callback(null, {
            job_id: artifact.jobId,
            format: artifact.format,
            artifact_url: `${base}${artifact.artifactPath}`,
            file_name: artifact.fileName,
            site_url: artifact.format === "web" ? `${base}${artifact.artifactPath}` : "",
        });
    } catch (error) {
        console.error(`[gRPC] RenderArtifact error: format=${format}, err=${error instanceof Error ? error.message : error}`);
        callback({
            code: grpc.status.INTERNAL,
            message: error instanceof Error ? error.message : "Failed to render Slidev artifact.",
        });
    }
}

export async function startGrpcServer() {
    const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
        keepCase: false,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true,
    });

    const protoDescriptor = grpc.loadPackageDefinition(packageDefinition);
    const SlidevService = protoDescriptor.paperpuppy.backendintl.slidev.SlidevService;

    const server = new grpc.Server();
    server.addService(SlidevService.service, {
        BuildPreview: buildPreviewHandler,
        RenderArtifact: renderArtifactHandler,
    });

    return new Promise((resolve, reject) => {
        server.bindAsync(
            `0.0.0.0:${GRPC_PORT}`,
            grpc.ServerCredentials.createInsecure(),
            (err, port) => {
                if (err) {
                    reject(err);
                    return;
                }
                console.log(`[slidev-renderer] gRPC server listening on :${port}`);
                resolve(server);
            },
        );
    });
}
