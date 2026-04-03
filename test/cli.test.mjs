import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import {mkdir, mkdtemp, readFile, rm, stat, writeFile} from "node:fs/promises";
import {join} from "node:path";
import {runCli} from "../src/cli.mjs";
import {getBundledThemesRoot} from "../packages/core/src/config/index.mjs";

async function waitForHtml(url, predicate, {
    timeoutMs = 5000,
    intervalMs = 200,
} = {}) {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
        const html = await fetch(url).then((response) => response.text());
        if (predicate(html)) {
            return html;
        }
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }

    throw new Error(`Timed out waiting for ${url}`);
}

test("CLI build command generates a static site from a local project", async () => {
    const tempRoot = await mkdtemp(join(os.tmpdir(), "markos-cli-"));
    const projectRoot = join(tempRoot, "project");
    const outDir = join(projectRoot, "dist");
    const themesRoot = getBundledThemesRoot();
    const themeName = `build-theme-${Date.now()}`;
    const themeFilePath = join(themesRoot, `${themeName}.css`);

    try {
        await mkdir(projectRoot, {recursive: true});
        await mkdir(themesRoot, {recursive: true});

        await writeFile(
            join(projectRoot, "slides.md"),
            [
                "---",
                `theme: ${themeName}`,
                "title: CLI Deck",
                "---",
                "",
                "# Hello CLI",
            ].join("\n"),
            "utf8",
        );
        await writeFile(themeFilePath, ".theme-title { color: blue; }\n", "utf8");
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
        assert.match(html, /\.theme-title \{ color: blue; \}/);
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
        await rm(themeFilePath, {force: true}).catch(() => {
        });
        await rm(tempRoot, {recursive: true, force: true});
    }
});

test("CLI build supports UTF-8 BOM in slides.md and still applies file-level theme", async () => {
    const tempRoot = await mkdtemp(join(os.tmpdir(), "markos-cli-bom-"));
    const projectRoot = join(tempRoot, "project");
    const outDir = join(projectRoot, "dist");
    const themesRoot = getBundledThemesRoot();
    const themeName = `bom-theme-${Date.now()}`;
    const themeFilePath = join(themesRoot, `${themeName}.css`);

    try {
        await mkdir(projectRoot, {recursive: true});
        await mkdir(themesRoot, {recursive: true});

        await writeFile(
            join(projectRoot, "slides.md"),
            `\uFEFF---\ntheme: ${themeName}\ntitle: BOM Deck\n---\n\n---\nlayout: cover\nclass: slide-shell title-slide\n---\n\n# Hello BOM\n`,
            "utf8",
        );
        await writeFile(themeFilePath, ".bom-theme { color: blue; }\n", "utf8");

        const result = await runCli([
            "build",
            projectRoot,
            "--out-dir",
            outDir,
        ]);

        const html = await readFile(join(outDir, "index.html"), "utf8");

        assert.equal(result.ok, true);
        assert.match(html, /BOM Deck/);
        assert.match(html, /Hello BOM/);
        assert.match(html, /\.bom-theme \{ color: blue; \}/);
    } finally {
        await rm(themeFilePath, {force: true}).catch(() => {
        });
        await rm(tempRoot, {recursive: true, force: true});
    }
});

test("CLI build resolves bundled themes even when the caller cwd is the deck directory", async () => {
    const tempRoot = await mkdtemp(join(os.tmpdir(), "markos-cli-cwd-build-"));
    const deckRoot = join(tempRoot, "deck");
    const outDir = join(tempRoot, "dist");
    const originalCwd = process.cwd();

    try {
        await mkdir(deckRoot, {recursive: true});
        await writeFile(
            join(deckRoot, "slides.md"),
            [
                "---",
                "theme: Clay",
                "title: Bundled Theme Deck",
                "---",
                "",
                "# Hello Bundled Theme",
            ].join("\n"),
            "utf8",
        );
        await writeFile(join(deckRoot, "slides.css"), ".slide h1 { color: #f06b1f; }\n", "utf8");

        process.chdir(deckRoot);
        const result = await runCli([
            "build",
            ".",
            "--out-dir",
            outDir,
        ]);

        const html = await readFile(join(outDir, "index.html"), "utf8");

        assert.equal(result.ok, true);
        assert.match(html, /Bundled Theme Deck/);
        assert.match(html, /Hello Bundled Theme/);
        assert.match(html, /--ab-bg:/);
    } finally {
        process.chdir(originalCwd);
        await rm(tempRoot, {recursive: true, force: true});
    }
});

test("CLI build auto-loads agent-overrides.css after slides.css without an explicit import", async () => {
    const tempRoot = await mkdtemp(join(os.tmpdir(), "markos-cli-agent-css-"));
    const deckRoot = join(tempRoot, "deck");
    const outDir = join(tempRoot, "dist");

    try {
        await mkdir(deckRoot, {recursive: true});
        await writeFile(
            join(deckRoot, "slides.md"),
            [
                "---",
                "title: Agent CSS Deck",
                "---",
                "",
                "# Hello Agent CSS",
            ].join("\n"),
            "utf8",
        );
        await writeFile(join(deckRoot, "slides.css"), ".cascade-target { color: #f06b1f; }\n", "utf8");
        await writeFile(join(deckRoot, "agent-overrides.css"), ".cascade-target { color: green; }\n", "utf8");

        const result = await runCli([
            "build",
            deckRoot,
            "--out-dir",
            outDir,
        ]);

        const html = await readFile(join(outDir, "index.html"), "utf8");

        assert.equal(result.ok, true);
        assert.match(html, /Agent CSS Deck/);
        assert.match(html, /\.cascade-target \{ color: #f06b1f; \}/);
        assert.match(html, /\.cascade-target \{ color: green; \}/);
        assert.ok(html.indexOf(".cascade-target { color: #f06b1f; }") < html.indexOf(".cascade-target { color: green; }"));
        await assert.rejects(
            () => readFile(join(outDir, "agent-overrides.css"), "utf8"),
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
    const themesRoot = getBundledThemesRoot();
    const themeName = `dev-theme-${Date.now()}`;
    const themeFilePath = join(themesRoot, `${themeName}.css`);
    let result = null;

    try {
        await mkdir(projectRoot, {recursive: true});
        await mkdir(join(projectRoot, "dist"), {recursive: true});
        await mkdir(themesRoot, {recursive: true});

        await writeFile(
            join(projectRoot, "slides.md"),
            [
                "---",
                `theme: ${themeName}`,
                "title: CLI Dev Deck",
                "---",
                "",
                "# Hello Dev",
            ].join("\n"),
            "utf8",
        );
        await writeFile(themeFilePath, ".theme-dev { color: blue; }\n", "utf8");
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
        assert.match(slidesHtml, /\.theme-dev \{ color: blue; \}/);
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
        await rm(themeFilePath, {force: true}).catch(() => {
        });
        await rm(tempRoot, {recursive: true, force: true});
    }
});

test("CLI dev rebuilds when a bundled theme source file changes", async () => {
    const tempRoot = await mkdtemp(join(os.tmpdir(), "markos-cli-dev-theme-"));
    const projectRoot = join(tempRoot, "project");
    const outDir = join(projectRoot, ".markos-dev");
    const themesRoot = getBundledThemesRoot();
    const themeName = `watch-theme-${process.pid}-${Date.now()}`;
    const themeFilePath = join(themesRoot, `${themeName}.css`);
    let result = null;

    try {
        await mkdir(projectRoot, {recursive: true});
        await writeFile(
            join(projectRoot, "slides.md"),
            [
                "---",
                `theme: ${themeName}`,
                "title: Theme Watch Deck",
                "---",
                "",
                "# Hello Watch",
            ].join("\n"),
            "utf8",
        );
        await writeFile(join(projectRoot, "slides.css"), ".slide h1 { color: #f06b1f; }\n", "utf8");
        await writeFile(themeFilePath, ".theme-version-a { color: blue; }\n", "utf8");

        result = await runCli([
            "dev",
            projectRoot,
            "--out-dir",
            outDir,
            "--port",
            "0",
        ]);

        const firstHtml = await fetch(result.url).then((response) => response.text());
        assert.match(firstHtml, /\.theme-version-a \{ color: blue; \}/);

        await writeFile(themeFilePath, ".theme-version-b { color: green; }\n", "utf8");

        const updatedHtml = await waitForHtml(
            result.url,
            (html) => html.includes(".theme-version-b { color: green; }"),
        );

        assert.match(updatedHtml, /\.theme-version-b \{ color: green; \}/);
        assert.doesNotMatch(updatedHtml, /\.theme-version-a \{ color: blue; \}/);
    } finally {
        await result?.stop?.().catch(() => {
        });
        await rm(themeFilePath, {force: true}).catch(() => {
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

test("CLI theme apply writes file-level theme metadata and preserves deck-local overrides", async () => {
    const tempRoot = await mkdtemp(join(os.tmpdir(), "markos-theme-"));
    const deckRoot = join(tempRoot, "deck");
    const themesRoot = getBundledThemesRoot();
    const themeName = `test-theme-${Date.now()}`;
    const themeFilePath = join(themesRoot, `${themeName}.css`);

    try {
        await mkdir(deckRoot, {recursive: true});
        await mkdir(themesRoot, {recursive: true});
        await writeFile(join(deckRoot, "slides.md"), "# Deck\n", "utf8");
        await writeFile(join(deckRoot, "slides.css"), ".old { color: blue; }\n", "utf8");
        await writeFile(themeFilePath, ".theme { color: red; }\n", "utf8");

        const result = await runCli([
            "theme",
            "apply",
            themeName,
            deckRoot,
        ]);

        const css = await readFile(join(deckRoot, "slides.css"), "utf8");
        const markdown = await readFile(join(deckRoot, "slides.md"), "utf8");

        assert.equal(result.ok, true);
        assert.equal(result.command, "theme");
        assert.equal(result.action, "apply");
        assert.equal(result.themeName, themeName);
        assert.equal(css, ".old { color: blue; }\n");
        assert.match(markdown, new RegExp(`theme:\\s+"${themeName}"`));
    } finally {
        await rm(themeFilePath, {force: true}).catch(() => {
        });
        await rm(tempRoot, {recursive: true, force: true});
    }
});

test("CLI theme apply inserts a separate file-frontmatter block above an old first-slide block", async () => {
    const tempRoot = await mkdtemp(join(os.tmpdir(), "markos-theme-legacy-"));
    const deckRoot = join(tempRoot, "deck");
    const themesRoot = getBundledThemesRoot();
    const themeName = `legacy-theme-${Date.now()}`;
    const themeFilePath = join(themesRoot, `${themeName}.css`);

    try {
        await mkdir(deckRoot, {recursive: true});
        await mkdir(themesRoot, {recursive: true});
        await writeFile(
            join(deckRoot, "slides.md"),
            [
                "---",
                "layout: cover",
                "class: slide-shell title-slide",
                "---",
                "",
                "# Legacy Deck",
            ].join("\n"),
            "utf8",
        );
        await writeFile(themeFilePath, ".theme { color: red; }\n", "utf8");

        const result = await runCli([
            "theme",
            "apply",
            themeName,
            deckRoot,
        ]);

        const markdown = await readFile(join(deckRoot, "slides.md"), "utf8");

        assert.equal(result.ok, true);
        assert.match(
            markdown,
            new RegExp(
                `^---\\ntheme: "${themeName}"\\n---\\n\\n---\\nlayout: cover\\nclass: slide-shell title-slide\\n---`,
            ),
        );
    } finally {
        await rm(themeFilePath, {force: true}).catch(() => {
        });
        await rm(tempRoot, {recursive: true, force: true});
    }
});

test("CLI theme apply resolves bundled themes even when run from the deck cwd", async () => {
    const tempRoot = await mkdtemp(join(os.tmpdir(), "markos-theme-cwd-"));
    const deckRoot = join(tempRoot, "deck");
    const originalCwd = process.cwd();

    try {
        await mkdir(deckRoot, {recursive: true});
        await writeFile(join(deckRoot, "slides.md"), "# Deck\n", "utf8");

        process.chdir(deckRoot);
        const result = await runCli([
            "theme",
            "apply",
            "Clay",
            ".",
        ]);

        const css = await readFile(join(deckRoot, "slides.css"), "utf8");
        const markdown = await readFile(join(deckRoot, "slides.md"), "utf8");

        assert.equal(result.ok, true);
        assert.equal(result.themeName, "Clay");
        assert.equal(css, "/* Local theme overrides */\n");
        assert.match(markdown, /theme:\s+"Clay"/);
    } finally {
        process.chdir(originalCwd);
        await rm(tempRoot, {recursive: true, force: true});
    }
});
