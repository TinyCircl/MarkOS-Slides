import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import {mkdir, mkdtemp, readFile, rm, writeFile} from "node:fs/promises";
import {join} from "node:path";
import {runCli} from "../src/cli.mjs";

test("CLI build command generates a static site from a local project", async () => {
    const tempRoot = await mkdtemp(join(os.tmpdir(), "markos-cli-"));
    const projectRoot = join(tempRoot, "project");
    const outDir = join(projectRoot, "dist");

    try {
        await mkdir(join(projectRoot, "styles"), {recursive: true});
        await mkdir(join(projectRoot, "assets"), {recursive: true});

        await writeFile(
            join(projectRoot, "slides.md"),
            [
                "---",
                "title: CLI Deck",
                "---",
                "",
                "# Hello CLI",
                "",
                "![Alt](./assets/logo.txt)",
            ].join("\n"),
            "utf8",
        );
        await writeFile(join(projectRoot, "styles", "index.css"), ".accent { color: #f06b1f; }\n", "utf8");
        await writeFile(join(projectRoot, "assets", "logo.txt"), "logo", "utf8");

        const result = await runCli([
            "build",
            join(projectRoot, "slides.md"),
            "--out-dir",
            outDir,
            "--base",
            "/deck/",
        ]);

        const html = await readFile(join(outDir, "index.html"), "utf8");
        const copiedAsset = await readFile(join(outDir, "assets", "logo.txt"), "utf8");

        assert.equal(result.ok, true);
        assert.equal(result.command, "build");
        assert.equal(result.basePath, "/deck/");
        assert.match(html, /CLI Deck/);
        assert.match(html, /Hello CLI/);
        assert.match(html, /"basePath":"\/deck\/"/);
        assert.equal(copiedAsset, "logo");
    } finally {
        await rm(tempRoot, {recursive: true, force: true});
    }
});

test("CLI dev command serves the generated static site locally", async () => {
    const tempRoot = await mkdtemp(join(os.tmpdir(), "markos-cli-dev-"));
    const projectRoot = join(tempRoot, "project");
    const outDir = join(projectRoot, ".markos-dev");
    let result = null;

    try {
        await mkdir(join(projectRoot, "styles"), {recursive: true});
        await mkdir(join(projectRoot, "assets"), {recursive: true});

        await writeFile(
            join(projectRoot, "slides.md"),
            [
                "---",
                "title: CLI Dev Deck",
                "---",
                "",
                "# Hello Dev",
                "",
                "![Alt](./assets/logo.txt)",
            ].join("\n"),
            "utf8",
        );
        await writeFile(join(projectRoot, "styles", "index.css"), ".accent { color: #f06b1f; }\n", "utf8");
        await writeFile(join(projectRoot, "assets", "logo.txt"), "logo", "utf8");

        result = await runCli([
            "dev",
            join(projectRoot, "slides.md"),
            "--out-dir",
            outDir,
            "--base",
            "/deck/",
            "--port",
            "0",
        ]);

        const slidesHtml = await fetch(`${result.url}?slide=1`).then((response) => response.text());
        const presenterHtml = await fetch(`${result.url}presenter/?slide=1`).then((response) => response.text());
        const assetText = await fetch(`${result.url}assets/logo.txt`).then((response) => response.text());

        assert.equal(result.ok, true);
        assert.equal(result.command, "dev");
        assert.match(slidesHtml, /CLI Dev Deck/);
        assert.match(slidesHtml, /Hello Dev/);
        assert.match(presenterHtml, /Presenter Mode/);
        assert.equal(assetText, "logo");
    } finally {
        await result?.stop?.().catch(() => {
        });
        await rm(tempRoot, {recursive: true, force: true});
    }
});

test("CLI export command fails with a clear unsupported message", async () => {
    await assert.rejects(
        () => runCli(["export", "slides.md"]),
        /not available yet/,
    );
});
