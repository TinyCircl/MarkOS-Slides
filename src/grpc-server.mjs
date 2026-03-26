import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import grpc from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";
import { z } from "zod";
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
const PREVIEW_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

const RENDER_FORMAT_MAP = {
    0: "web",
    1: "pdf",
    2: "pptx",
    RENDER_FORMAT_WEB: "web",
    RENDER_FORMAT_PDF: "pdf",
    RENDER_FORMAT_PPTX: "pptx",
};

const grpcBuildPreviewRequestSchema = z.object({
    previewId: z.string().trim().regex(PREVIEW_ID_PATTERN),
    content: z.string(),
    title: z.string().trim().nullable().optional(),
    publish: z.boolean().optional(),
    basePath: z.string().trim().optional(),
}).superRefine((value, ctx) => {
    if (value.basePath) {
        const normalizedBasePath = `/${value.basePath.replace(/^\/+|\/+$/g, "")}/`;
        const expectedBasePath = `/p/${value.previewId}/`;
        if (normalizedBasePath !== expectedBasePath) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `basePath must match ${expectedBasePath}`,
                path: ["basePath"],
            });
        }
    }
});

const grpcRenderArtifactRequestSchema = z.object({
    content: z.string(),
    title: z.string().trim().nullable().optional(),
    format: z.enum(["web", "pdf", "pptx"]),
    fileName: z.string().trim().nullable().optional(),
});

function getServiceBaseUrl() {
    return PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 3210}`;
}

function joinServiceUrl(path) {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    return `${getServiceBaseUrl()}${normalizedPath}`;
}

function getLocalPreviewUrl(previewPath) {
    return joinServiceUrl(previewPath);
}

function getPublishedPreviewUrl(previewId) {
    if (!PREVIEW_SITE_BASE_URL) {
        return "";
    }
    return new URL(`/p/${encodeURIComponent(previewId)}/`, `${PREVIEW_SITE_BASE_URL}/`).toString();
}

function formatZodError(error) {
    return error.issues
        .map((issue) => {
            const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
            return `${path}${issue.message}`;
        })
        .join("; ");
}

export function createGrpcError(error, fallbackMessage) {
    const fullMsg = error instanceof z.ZodError
        ? formatZodError(error)
        : error instanceof Error
            ? error.message
            : fallbackMessage;

    return {
        code: error instanceof z.ZodError ? grpc.status.INVALID_ARGUMENT : grpc.status.INTERNAL,
        message: fullMsg.length > 1024 ? `${fullMsg.slice(0, 1024)}… (truncated)` : fullMsg,
    };
}

export function parseGrpcBuildPreviewRequest(request) {
    return grpcBuildPreviewRequestSchema.parse({
        previewId: request.previewId,
        content: request.content,
        title: request.title || undefined,
        publish: request.publish,
        basePath: request.basePath || undefined,
    });
}

export function parseGrpcRenderArtifactRequest(request) {
    return grpcRenderArtifactRequestSchema.parse({
        content: request.content,
        title: request.title || undefined,
        format: RENDER_FORMAT_MAP[request.format] ?? "",
        fileName: request.fileName || undefined,
    });
}

export function buildRenderArtifactGrpcResponse(artifact) {
    const artifactUrl = joinServiceUrl(artifact.artifactPath);
    return {
        jobId: artifact.jobId,
        format: artifact.format,
        artifactUrl,
        fileName: artifact.fileName,
        siteUrl: artifact.format === "web" ? artifactUrl : "",
    };
}

async function buildPreviewHandler(call, callback) {
    const req = call.request;
    const requestStartedAt = Date.now();
    console.log(`[gRPC] BuildPreview: previewId=${req.previewId}, contentLen=${req.content?.length ?? 0}, publish=${req.publish}`);

    try {
        const payload = parseGrpcBuildPreviewRequest(req);
        const buildStartedAt = Date.now();
        const preview = await buildPreviewSite({
            previewId: payload.previewId,
            content: payload.content,
            title: payload.title || undefined,
            basePath: payload.basePath || undefined,
            publish: false,
        });
        const buildDurationMs = Date.now() - buildStartedAt;
        console.log(`[gRPC] BuildPreview done: previewId=${preview.previewId}, buildId=${preview.buildId}, cacheHit=${preview.cacheHit}, buildMs=${buildDurationMs}`);

        let publishDurationMs = 0;
        let publishedPreviewUrl = "";

        if (payload.publish && isR2Configured()) {
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
            localPreviewUrl: getLocalPreviewUrl(preview.previewPath),
            publishedPreviewUrl: publishedPreviewUrl,
            timings: {
                totalMs: Date.now() - requestStartedAt,
                buildMs: buildDurationMs,
                publishMs: publishDurationMs,
            },
        });
    } catch (error) {
        const grpcError = createGrpcError(error, "Failed to build Slidev preview.");
        console.error(`[gRPC] BuildPreview error: previewId=${req.previewId}, err=${grpcError.message}`);
        callback(grpcError);
    }
}

async function renderArtifactHandler(call, callback) {
    const req = call.request;
    const requestedFormat = RENDER_FORMAT_MAP[req.format] ?? "invalid";
    console.log(`[gRPC] RenderArtifact: format=${requestedFormat}, contentLen=${req.content?.length ?? 0}`);
    const startedAt = Date.now();

    try {
        const payload = parseGrpcRenderArtifactRequest(req);
        const artifact = await renderArtifact({
            content: payload.content,
            title: payload.title || undefined,
            format: payload.format,
            fileName: payload.fileName || undefined,
        });

        console.log(`[gRPC] RenderArtifact done: jobId=${artifact.jobId}, format=${artifact.format}, costMs=${Date.now() - startedAt}`);
        callback(null, buildRenderArtifactGrpcResponse(artifact));
    } catch (error) {
        const grpcError = createGrpcError(error, "Failed to render Slidev artifact.");
        console.error(`[gRPC] RenderArtifact error: format=${requestedFormat}, err=${grpcError.message}`);
        callback(grpcError);
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
