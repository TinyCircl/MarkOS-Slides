import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import {mkdir, mkdtemp, readFile, rm, writeFile} from "node:fs/promises";
import {join} from "node:path";
import {markosWebRenderEngine} from "../src/engines/markos-web/index.mjs";

test("markos-web builds a static deck with inlined css and copied assets", async () => {
    const tempRoot = await mkdtemp(join(os.tmpdir(), "markos-engine-"));
    const workDir = join(tempRoot, "work");
    const outDir = join(tempRoot, "out");

    try {
        await mkdir(join(workDir, "styles"), {recursive: true});
        await mkdir(join(workDir, "assets"), {recursive: true});
        await writeFile(
            join(workDir, "slides.md"),
            [
                "---",
                "title: Demo Deck",
                "aspectRatio: 4/3",
                "---",
                "",
                "# Hello Engine",
                "",
                "![Alt](./assets/logo.txt)",
                "",
                "---",
                "layout: two-cols",
                "---",
                "",
                "## Left",
                "",
                "::right::",
                "",
                "## Right",
            ].join("\n"),
            "utf8",
        );
        await writeFile(join(workDir, "styles", "index.css"), "@import \"./theme.css\";\n", "utf8");
        await writeFile(join(workDir, "styles", "theme.css"), ".accent { color: #f06b1f; }\n", "utf8");
        await writeFile(join(workDir, "assets", "logo.txt"), "logo", "utf8");

        await markosWebRenderEngine.buildStaticSite({
            entryFilePath: join(workDir, "slides.md"),
            outputDir: outDir,
            basePath: "/p/demo-preview/",
            cwd: workDir,
        });

        const html = await readFile(join(outDir, "index.html"), "utf8");
        const copiedAsset = await readFile(join(outDir, "assets", "logo.txt"), "utf8");
        const logo = await readFile(join(outDir, "assets", "markdos-icon.svg"), "utf8");

        assert.match(html, /Demo Deck/);
        assert.match(html, /Hello Engine/);
        assert.match(html, /"title":"Left"/);
        assert.doesNotMatch(html, /"title":"layout: two-cols"/);
        assert.match(html, /"basePath":"\/p\/demo-preview\/"/);
        assert.match(html, /assets\/markdos-icon\.svg/);
        assert.match(html, /\.accent\s*\{\s*color:\s*#f06b1f;/);
        assert.match(html, /Overview/);
        assert.equal(copiedAsset, "logo");
        assert.match(logo, /Markdos logo/);
    } finally {
        await rm(tempRoot, {recursive: true, force: true});
    }
});

test("markos-web falls back to built-in css presets when no local styles are provided", async () => {
    const tempRoot = await mkdtemp(join(os.tmpdir(), "markos-preset-"));
    const workDir = join(tempRoot, "work");
    const outDir = join(tempRoot, "out");

    try {
        await mkdir(workDir, {recursive: true});
        await writeFile(
            join(workDir, "slides.md"),
            [
                "---",
                "title: Preset Deck",
                "theme: default",
                "layout: cover",
                "class: slide-shell title-slide text-left",
                "---",
                "",
                "# Preset Slide",
            ].join("\n"),
            "utf8",
        );

        await markosWebRenderEngine.buildStaticSite({
            entryFilePath: join(workDir, "slides.md"),
            outputDir: outDir,
            basePath: "/p/preset-demo/",
            cwd: workDir,
        });

        const html = await readFile(join(outDir, "index.html"), "utf8");
        assert.match(html, /\.slide-shell \{/);
        assert.match(html, /\.title-slide \{/);
        assert.match(html, /Preset Deck/);
        assert.match(html, /Preset Slide/);
    } finally {
        await rm(tempRoot, {recursive: true, force: true});
    }
});
