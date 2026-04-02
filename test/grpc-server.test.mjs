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

function loadRendererService() {
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
    const service = loadRendererService();
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

test("RenderArtifact gRPC request rejects pdf while markos renderer is web-only", () => {
    assert.throws(
        () => parseGrpcRenderArtifactRequest({
            content: "# demo",
            format: "RENDER_FORMAT_PDF",
            fileName: "",
            title: "",
        }),
        /Only web format is currently supported/,
    );
});

test("BuildPreview gRPC request accepts folder-style source files", () => {
    const parsed = parseGrpcBuildPreviewRequest({
        previewId: "demo-preview",
        content: "",
        title: "demo",
        publish: false,
        basePath: "/p/demo-preview/",
        entry: "slides.md",
        sourceFiles: [
            {
                path: "slides.md",
                content: "---\ncss: ./styles.css\n---\n\n# demo\n",
            },
            {
                path: "styles.css",
                binaryContent: Buffer.from(".accent { color: red; }", "utf8"),
            },
        ],
    });

    assert.equal(parsed.entry, "slides.md");
    assert.equal(parsed.source.files.length, 2);
    assert.equal(parsed.source.files[0].path, "slides.md");
    assert.equal(parsed.source.files[0].content.includes("css: ./styles.css"), true);
    assert.equal(parsed.source.files[1].path, "styles.css");
    assert.equal(typeof parsed.source.files[1].contentBase64, "string");
});
