import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import {mkdir, mkdtemp, readFile, rm, writeFile} from "node:fs/promises";
import {join} from "node:path";
import {markosWebRenderEngine} from "../src/engines/markos-web/index.mjs";

test("markos-web builds a static deck with theme css, deck css, and overrides css in order", async () => {
    const tempRoot = await mkdtemp(join(os.tmpdir(), "markos-engine-"));
    const workDir = join(tempRoot, "work");
    const outDir = join(tempRoot, "out");

    try {
        await mkdir(join(workDir, ".markos-theme"), {recursive: true});
        await writeFile(
            join(workDir, "slides.md"),
            [
                "---",
                "title: Demo Deck",
                "theme: Clay",
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
        await writeFile(join(workDir, ".markos-theme", "Clay.css"), ".slide h2 { color: blue; }\n", "utf8");
        await writeFile(join(workDir, "slides.css"), ".slide h2 { color: #f06b1f; }\n", "utf8");
        await writeFile(join(workDir, "overrides.css"), ".slide h2 { color: green; }\n", "utf8");

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
        assert.match(html, /\.slide h2 \{ color: blue; \}/);
        assert.match(html, /\.slide h2 \{ color: #f06b1f; \}/);
        assert.match(html, /\.slide h2 \{ color: green; \}/);
        assert.ok(html.indexOf(".slide h2 { color: blue; }") < html.indexOf(".slide h2 { color: #f06b1f; }"));
        assert.ok(html.indexOf(".slide h2 { color: #f06b1f; }") < html.indexOf(".slide h2 { color: green; }"));
        assert.match(html, /Overview/);
        assert.match(logo, /Markdos logo/);
        await assert.rejects(
            () => readFile(join(outDir, "slides.css"), "utf8"),
            /ENOENT/,
        );
        await assert.rejects(
            () => readFile(join(outDir, "overrides.css"), "utf8"),
            /ENOENT/,
        );
    } finally {
        await rm(tempRoot, {recursive: true, force: true});
    }
});

test("markos-web does not load a shared theme when no file-level theme is declared", async () => {
    const tempRoot = await mkdtemp(join(os.tmpdir(), "markos-preset-"));
    const workDir = join(tempRoot, "work");
    const outDir = join(tempRoot, "out");

    try {
        await mkdir(join(workDir, ".markos-theme"), {recursive: true});
        await writeFile(
            join(workDir, "slides.md"),
            [
                "---",
                "title: Preset Deck",
                "---",
                "",
                "---",
                "layout: cover",
                "class: slide-shell title-slide text-left",
                "---",
                "",
                "# Preset Slide",
            ].join("\n"),
            "utf8",
        );
        await writeFile(join(workDir, ".markos-theme", "Clay.css"), ".slide-shell { color: blue; }\n", "utf8");

        await markosWebRenderEngine.buildStaticSite({
            entryFilePath: join(workDir, "slides.md"),
            outputDir: outDir,
            basePath: "/p/preset-demo/",
            cwd: workDir,
        });

        const html = await readFile(join(outDir, "index.html"), "utf8");
        assert.match(html, /Preset Deck/);
        assert.match(html, /Preset Slide/);
        assert.doesNotMatch(html, /\.slide-shell \{ color: blue; \}/);
    } finally {
        await rm(tempRoot, {recursive: true, force: true});
    }
});

test("markos-web rejects file-level theme names that include a .css suffix", async () => {
    const tempRoot = await mkdtemp(join(os.tmpdir(), "markos-engine-theme-suffix-"));
    const workDir = join(tempRoot, "work");
    const outDir = join(tempRoot, "out");

    try {
        await mkdir(join(workDir, ".markos-theme"), {recursive: true});
        await writeFile(
            join(workDir, "slides.md"),
            [
                "---",
                "title: Invalid Theme Deck",
                "theme: Clay.css",
                "---",
                "",
                "# Invalid Theme",
            ].join("\n"),
            "utf8",
        );
        await writeFile(join(workDir, ".markos-theme", "Clay.css"), ".slide-shell { color: blue; }\n", "utf8");

        await assert.rejects(
            () => markosWebRenderEngine.buildStaticSite({
                entryFilePath: join(workDir, "slides.md"),
                outputDir: outDir,
                basePath: "/",
                cwd: workDir,
            }),
            /Theme name must not include the \.css suffix/,
        );
    } finally {
        await rm(tempRoot, {recursive: true, force: true});
    }
});

test("markos-web treats the opening frontmatter block as deck-level metadata", async () => {
    const tempRoot = await mkdtemp(join(os.tmpdir(), "markos-first-slide-"));
    const workDir = join(tempRoot, "work");
    const outDir = join(tempRoot, "out");

    try {
        await mkdir(workDir, {recursive: true});
        await writeFile(
            join(workDir, "slides.md"),
            [
                "---",
                "title: Deck Name",
                "aspectRatio: 4/3",
                "---",
                "",
                "---",
                "layout: cover",
                "class: slide-shell title-slide",
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
        assert.match(html, /Deck Name/);
        assert.match(html, /Visible Cover Heading/);
        assert.match(html, /slidev:aspect-ratio" content="4\/3"/);
        assert.match(html, /"title":"Visible Cover Heading"/);
    } finally {
        await rm(tempRoot, {recursive: true, force: true});
    }
});

test("markos-web rejects the old single leading page-frontmatter form", async () => {
    const tempRoot = await mkdtemp(join(os.tmpdir(), "markos-invalid-frontmatter-"));
    const workDir = join(tempRoot, "work");
    const outDir = join(tempRoot, "out");

    try {
        await mkdir(workDir, {recursive: true});
        await writeFile(
            join(workDir, "slides.md"),
            [
                "---",
                "layout: cover",
                "class: slide-shell title-slide",
                "---",
                "",
                "# Invalid Legacy Cover",
            ].join("\n"),
            "utf8",
        );

        await assert.rejects(
            () => markosWebRenderEngine.buildStaticSite({
                entryFilePath: join(workDir, "slides.md"),
                outputDir: outDir,
                basePath: "/",
                cwd: workDir,
            }),
            /Invalid file frontmatter key\(s\): layout, class/,
        );
    } finally {
        await rm(tempRoot, {recursive: true, force: true});
    }
});
