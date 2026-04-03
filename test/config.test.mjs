import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import {mkdir, mkdtemp, rm, writeFile} from "node:fs/promises";
import {join} from "node:path";
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
        entry: ".",
    });

    assert.equal(normalizeBasePath("/"), "/");
    assert.equal(normalizeBasePath("demo"), "/demo/");
    assert.equal(resolved.basePath, "/");
    assert.match(resolved.outDir, /dist$/);
    assert.match(resolved.workDir, /\.markos-work[\\/]+dist$/);
});

test("CLI path resolution accepts a deck directory and resolves slides.md inside it", async () => {
    const tempRoot = await mkdtemp(join(os.tmpdir(), "markos-config-"));
    const deckDir = join(tempRoot, "deck");

    try {
        await mkdir(deckDir, {recursive: true});
        await writeFile(join(deckDir, "slides.md"), "# Demo\n", "utf8");

        const resolved = resolveCliPaths({
            command: "build",
            entry: deckDir,
        });

        assert.equal(resolved.entryFilePath, join(deckDir, "slides.md"));
        assert.equal(resolved.projectRoot, deckDir);
        assert.match(resolved.outDir, /dist$/);
    } finally {
        await rm(tempRoot, {recursive: true, force: true});
    }
});

test("CLI path resolution rejects an explicit markdown file path", async () => {
    const tempRoot = await mkdtemp(join(os.tmpdir(), "markos-config-file-"));
    const deckDir = join(tempRoot, "deck");
    const entryFilePath = join(deckDir, "slides.md");

    try {
        await mkdir(deckDir, {recursive: true});
        await writeFile(entryFilePath, "# Demo\n", "utf8");

        assert.throws(
            () => resolveCliPaths({
                command: "build",
                entry: entryFilePath,
            }),
            /Deck path must be a directory containing slides\.md/,
        );
    } finally {
        await rm(tempRoot, {recursive: true, force: true});
    }
});

test("package-style entrypoints expose the intended public surface", () => {
    assert.equal(typeof corePackage.buildStaticSiteFromInput, "function");
    assert.equal(typeof corePackage.createLocalProjectInput, "function");
    assert.equal(typeof cliPackage.parseCliArgs, "function");
    assert.equal(typeof cliPackage.runCli, "function");
});
