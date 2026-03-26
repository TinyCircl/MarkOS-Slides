import test from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import grpc from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";
import {
    buildRenderArtifactGrpcResponse,
    parseGrpcBuildPreviewRequest,
    parseGrpcRenderArtifactRequest,
} from "../src/grpc-server.mjs";

function loadSlidevService() {
    const packageDefinition = protoLoader.loadSync(join(process.cwd(), "src", "slidev_service.proto"), {
        keepCase: false,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true,
    });

    const protoDescriptor = grpc.loadPackageDefinition(packageDefinition);
    return protoDescriptor.paperpuppy.backendintl.slidev.SlidevService.service;
}

test("RenderArtifact gRPC responses survive proto serialization", () => {
    const service = loadSlidevService();
    const response = buildRenderArtifactGrpcResponse({
        jobId: "job-123",
        format: "pdf",
        artifactPath: "/artifacts/job-123/demo.pdf",
        fileName: "demo.pdf",
    });

    const roundTripped = service.RenderArtifact.responseDeserialize(
        service.RenderArtifact.responseSerialize(response),
    );

    assert.deepEqual(roundTripped, {
        jobId: "job-123",
        format: "pdf",
        artifactUrl: "http://localhost:3210/artifacts/job-123/demo.pdf",
        fileName: "demo.pdf",
        siteUrl: "",
        cacheHit: false,
        publishCacheHit: false,
        publishedArtifactUrl: "",
    });
});

test("BuildPreview gRPC request validation rejects invalid preview ids", () => {
    assert.throws(
        () => parseGrpcBuildPreviewRequest({
            previewId: "../escape",
            content: "# demo",
            publish: false,
            basePath: "",
            title: "",
        }),
        /Invalid string/,
    );
});

test("BuildPreview gRPC request validation rejects mismatched basePath", () => {
    assert.throws(
        () => parseGrpcBuildPreviewRequest({
            previewId: "demo-preview",
            content: "# demo",
            publish: false,
            basePath: "/preview/demo-preview/",
            title: "",
        }),
        /basePath must match \/p\/demo-preview\//,
    );
});

test("RenderArtifact gRPC request validation rejects unknown formats", () => {
    assert.throws(
        () => parseGrpcRenderArtifactRequest({
            content: "# demo",
            format: "RENDER_FORMAT_DOCX",
            fileName: "",
            title: "",
        }),
        /Invalid option/,
    );
});
