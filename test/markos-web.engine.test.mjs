import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import {mkdir, mkdtemp, readFile, rm, writeFile} from "node:fs/promises";
import {join} from "node:path";
import {markosWebRenderEngine} from "../src/engines/markos-web/index.mjs";

test("markos-web builds a static deck with sibling css inlined into the HTML", async () => {
    const tempRoot = await mkdtemp(join(os.tmpdir(), "markos-engine-"));
    const workDir = join(tempRoot, "work");
    const outDir = join(tempRoot, "out");

    try {
        await mkdir(workDir, {recursive: true});
        await writeFile(
            join(workDir, "slides.md"),
            [
                "---",
                "title: Demo Deck",
                "---",
                "",
                "# Hello Engine",
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
        await writeFile(join(workDir, "slides.css"), ".slide h2 { color: #f06b1f; }\n", "utf8");

        await markosWebRenderEngine.buildStaticSite({
            entryFilePath: join(workDir, "slides.md"),
            outputDir: outDir,
            basePath: "/p/demo-preview/",
            cwd: workDir,
        });

        const html = await readFile(join(outDir, "index.html"), "utf8");
        const logo = await readFile(join(outDir, "assets", "markdos-icon.svg"), "utf8");

        assert.match(html, /Demo Deck/);
        assert.match(html, /slidev:aspect-ratio" content="16\/9"/);
        assert.match(html, /Hello Engine/);
        assert.match(html, /"title":"Left"/);
        assert.doesNotMatch(html, /"title":"layout: two-cols"/);
        assert.match(html, /"basePath":"\/p\/demo-preview\/"/);
        assert.match(html, /assets\/markdos-icon\.svg/);
        assert.match(html, /\.slide h2 \{ color: #f06b1f; \}/);
        assert.match(html, /Overview/);
        assert.match(logo, /Markdos logo/);
        await assert.rejects(
            () => readFile(join(outDir, "slides.css"), "utf8"),
            /ENOENT/,
        );
    } finally {
        await rm(tempRoot, {recursive: true, force: true});
    }
});

test("markos-web no longer auto-loads theme preset css without a sibling css file", async () => {
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
        assert.match(html, /Preset Deck/);
        assert.match(html, /Preset Slide/);
        assert.doesNotMatch(html, /\.slide-shell \{/);
        assert.doesNotMatch(html, /\.title-slide \{/);
    } finally {
        await rm(tempRoot, {recursive: true, force: true});
    }
});

test("markos-web treats the opening frontmatter block as first-slide metadata, not deck-global config", async () => {
    const tempRoot = await mkdtemp(join(os.tmpdir(), "markos-first-slide-"));
    const workDir = join(tempRoot, "work");
    const outDir = join(tempRoot, "out");

    try {
        await mkdir(workDir, {recursive: true});
        await writeFile(
            join(workDir, "slides.md"),
            [
                "---",
                "title: First Slide Name",
                "layout: cover",
                "class: slide-shell title-slide",
                "aspectRatio: 4/3",
                "---",
                "",
                "# Visible Cover Heading",
            ].join("\n"),
            "utf8",
        );

        await markosWebRenderEngine.buildStaticSite({
            entryFilePath: join(workDir, "slides.md"),
            outputDir: outDir,
            basePath: "/",
            cwd: workDir,
        });

        const html = await readFile(join(outDir, "index.html"), "utf8");
        assert.match(html, /First Slide Name/);
        assert.match(html, /Visible Cover Heading/);
        assert.match(html, /slidev:aspect-ratio" content="16\/9"/);
        assert.match(html, /"title":"First Slide Name"/);
    } finally {
        await rm(tempRoot, {recursive: true, force: true});
    }
});
