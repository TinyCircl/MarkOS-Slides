import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import {mkdir, mkdtemp, readFile, rm, stat, writeFile} from "node:fs/promises";
import {join} from "node:path";
import {runCli} from "../src/cli.mjs";

test("CLI build command generates a static site from a local project", async () => {
    const tempRoot = await mkdtemp(join(os.tmpdir(), "markos-cli-"));
    const projectRoot = join(tempRoot, "project");
    const outDir = join(projectRoot, "dist");

    try {
        await mkdir(projectRoot, {recursive: true});

        await writeFile(
            join(projectRoot, "slides.md"),
            [
                "---",
                "title: CLI Deck",
                "---",
                "",
                "# Hello CLI",
            ].join("\n"),
            "utf8",
        );
        await writeFile(join(projectRoot, "slides.css"), ".slide h1 { color: #f06b1f; }\n", "utf8");
        await writeFile(join(projectRoot, "notes.txt"), "ignore me\n", "utf8");

        const result = await runCli([
            "build",
            projectRoot,
            "--out-dir",
            outDir,
            "--base",
            "/deck/",
        ]);

        const html = await readFile(join(outDir, "index.html"), "utf8");

        assert.equal(result.ok, true);
        assert.equal(result.command, "build");
        assert.equal(result.basePath, "/deck/");
        assert.match(html, /CLI Deck/);
        assert.match(html, /Hello CLI/);
        assert.match(html, /"basePath":"\/deck\/"/);
        assert.match(html, /\.slide h1 \{ color: #f06b1f; \}/);
        await assert.rejects(
            () => readFile(join(outDir, "notes.txt"), "utf8"),
            /ENOENT/,
        );
        await assert.rejects(
            () => stat(join(projectRoot, ".markos-work")),
            /ENOENT/,
        );
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
        await mkdir(projectRoot, {recursive: true});
        await mkdir(join(projectRoot, "dist"), {recursive: true});

        await writeFile(
            join(projectRoot, "slides.md"),
            [
                "---",
                "title: CLI Dev Deck",
                "---",
                "",
                "# Hello Dev",
            ].join("\n"),
            "utf8",
        );
        await writeFile(join(projectRoot, "slides.css"), ".slide h1 { color: #f06b1f; }\n", "utf8");
        await writeFile(join(projectRoot, "dist", "stale.txt"), "old build output\n", "utf8");
        await writeFile(join(projectRoot, "notes.txt"), "ignore me\n", "utf8");

        result = await runCli([
            "dev",
            projectRoot,
            "--out-dir",
            outDir,
            "--base",
            "/deck/",
            "--port",
            "0",
        ]);

        const slidesHtml = await fetch(`${result.url}?slide=1`).then((response) => response.text());
        const presenterHtml = await fetch(`${result.url}presenter/?slide=1`).then((response) => response.text());

        assert.equal(result.ok, true);
        assert.equal(result.command, "dev");
        assert.match(slidesHtml, /CLI Dev Deck/);
        assert.match(slidesHtml, /Hello Dev/);
        assert.match(slidesHtml, /\.slide h1 \{ color: #f06b1f; \}/);
        assert.match(presenterHtml, /Presenter Mode/);
        await assert.rejects(
            () => readFile(join(outDir, "dist", "stale.txt"), "utf8"),
            /ENOENT/,
        );
        await assert.rejects(
            () => readFile(join(outDir, "notes.txt"), "utf8"),
            /ENOENT/,
        );
        await assert.rejects(
            () => stat(join(projectRoot, ".markos-work")),
            /ENOENT/,
        );
    } finally {
        await result?.stop?.().catch(() => {
        });
        await rm(tempRoot, {recursive: true, force: true});
    }
});

test("CLI export command fails with a clear unsupported message", async () => {
    await assert.rejects(
        () => runCli(["export", "."]),
        /not available yet/,
    );
});
