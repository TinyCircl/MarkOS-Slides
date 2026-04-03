import test from "node:test";
import assert from "node:assert/strict";
import {normalizeBasePath} from "../src/core/path-utils.mjs";
import {
    getArtifactStoreConfig,
    getCliRuntimeOptions,
    getPreviewSessionConfig,
    getServerRuntimeConfig,
    resolveCliPaths,
} from "../src/config/index.mjs";
import * as corePackage from "../src/index.mjs";
import * as cliPackage from "../src/cli/index.mjs";
import * as serverPackage from "../src/server/index.mjs";

test("shared runtime config keeps root base paths and defaults consistent", () => {
    const cli = getCliRuntimeOptions({command: "build"});
    const server = getServerRuntimeConfig({});
    const preview = getPreviewSessionConfig({});
    const artifactStore = getArtifactStoreConfig({});

    assert.equal(cli.basePath, "/");
    assert.equal(cli.sourceMode, corePackage.MARKOS_SOURCE_MODES.AUTHORING);
    assert.equal(server.httpPort, 3210);
    assert.equal(server.grpcPort, 50051);
    assert.equal(preview.sessionIdleTtlMs, 15 * 60 * 1000);
    assert.equal(artifactStore.localArtifactCleanupIntervalMs, 60 * 60 * 1000);
});

test("CLI path resolution and base path helpers normalize root paths", () => {
    const resolved = resolveCliPaths({
        command: "build",
        entry: "slides.md",
    });

    assert.equal(normalizeBasePath("/"), "/");
    assert.equal(normalizeBasePath("demo"), "/demo/");
    assert.equal(resolved.basePath, "/");
    assert.match(resolved.outDir, /dist$/);
    assert.match(resolved.workDir, /\.markos-work[\\/]+dist$/);
});

test("package-style entrypoints expose the intended public surface", () => {
    assert.equal(typeof corePackage.buildStaticSiteFromInput, "function");
    assert.equal(typeof corePackage.createLocalProjectInput, "function");
    assert.equal(typeof cliPackage.parseCliArgs, "function");
    assert.equal(typeof cliPackage.runCli, "function");
    assert.equal(typeof serverPackage.startServer, "function");
    assert.equal(typeof serverPackage.startGrpcServer, "function");
});
