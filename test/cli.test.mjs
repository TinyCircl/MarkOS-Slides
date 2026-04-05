import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import {chmod, mkdir, mkdtemp, readFile, rm, stat, writeFile} from "node:fs/promises";
import {join} from "node:path";
import {parseCliArgs, runCli} from "../src/cli.mjs";
import {getBundledThemesRoot} from "../packages/core/src/config/index.mjs";
import {MARKOS_THEME_ENTRY_FILENAME} from "../packages/cli/src/theme.mjs";

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

async function writeDirectoryTheme(themesRoot, themeName, css = "") {
    const themeDir = join(themesRoot, themeName);
    await mkdir(themeDir, {recursive: true});
    await writeFile(join(themeDir, MARKOS_THEME_ENTRY_FILENAME), css, "utf8");
    await writeFile(
        join(themeDir, "README.md"),
        `# ${themeName}\n\n- Shell: slide-shell\n`,
        "utf8",
    );
    return themeDir;
}

async function writeFakeExportBrowser(scriptPath) {
    const fakeExportModel = JSON.stringify({
        deck: {
            title: "Export Deck",
            width: 1280,
            height: 720,
        },
        slides: [
            {
                index: 0,
                title: "Hello Export",
                template: "default",
                backgroundColor: "rgb(255, 255, 255)",
                nodes: [
                    {
                        id: "slide-1.title",
                        kind: "text",
                        role: "title",
                        layer: 3,
                        order: 1,
                        x: 72,
                        y: 60,
                        w: 1136,
                        h: 56,
                        text: "Hello Export",
                        fontFamily: "Arial",
                        fontSizePx: 42,
                        fontWeight: "700",
                        fontStyle: "normal",
                        textAlign: "left",
                        color: "rgb(17, 24, 39)",
                    },
                    {
                        id: "slide-1.body",
                        kind: "text",
                        role: "p",
                        layer: 3,
                        order: 2,
                        x: 72,
                        y: 132,
                        w: 720,
                        h: 120,
                        text: "Summary line for export.",
                        fontFamily: "Arial",
                        fontSizePx: 22,
                        fontWeight: "400",
                        fontStyle: "normal",
                        textAlign: "left",
                        color: "rgb(55, 65, 81)",
                    },
                ],
            },
        ],
    });
    await writeFile(
        scriptPath,
        [
            "#!/bin/sh",
            "pdf_path=\"\"",
            "dump_dom=0",
            "for arg in \"$@\"; do",
            "  case \"$arg\" in",
            "    --print-to-pdf=*) pdf_path=\"${arg#--print-to-pdf=}\" ;;",
            "    --dump-dom) dump_dom=1 ;;",
            "  esac",
            "done",
            "if [ -n \"$MARKOS_TEST_EXPORT_BROWSER_LOG\" ]; then",
            "  printf '%s\\n' \"$@\" > \"$MARKOS_TEST_EXPORT_BROWSER_LOG\"",
            "fi",
            "if [ \"$dump_dom\" = \"1\" ]; then",
            `  printf '%s\\n' '<!doctype html><html><body><script id="__MARKOS_EXPORT_MODEL__" type="application/json">${fakeExportModel}</script></body></html>'`,
            "  exit 0",
            "fi",
            "printf '%s\\n' '%PDF-1.4' '%%EOF' > \"$pdf_path\"",
        ].join("\n"),
        "utf8",
    );
    await chmod(scriptPath, 0o755);
}

test("CLI build command generates a static site from a local project", async () => {
    const tempRoot = await mkdtemp(join(os.tmpdir(), "markos-cli-"));
    const projectRoot = join(tempRoot, "project");
    const outDir = join(projectRoot, "dist");
    const themesRoot = getBundledThemesRoot();
    const themeName = `build-theme-${Date.now()}`;
    const themeDirPath = join(themesRoot, themeName);

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
        await writeDirectoryTheme(themesRoot, themeName, ".theme-title { color: blue; }\n");
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
        await rm(themeDirPath, {recursive: true, force: true}).catch(() => {
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
    const themeDirPath = join(themesRoot, themeName);

    try {
        await mkdir(projectRoot, {recursive: true});
        await mkdir(themesRoot, {recursive: true});

        await writeFile(
            join(projectRoot, "slides.md"),
            `\uFEFF---\ntheme: ${themeName}\ntitle: BOM Deck\n---\n\n---\nlayout: cover\nclass: slide-shell title-slide\n---\n\n# Hello BOM\n`,
            "utf8",
        );
        await writeDirectoryTheme(themesRoot, themeName, ".bom-theme { color: blue; }\n");

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
        await rm(themeDirPath, {recursive: true, force: true}).catch(() => {
        });
        await rm(tempRoot, {recursive: true, force: true});
    }
});

test("CLI build bundles local @import files from a split bundled theme", async () => {
    const tempRoot = await mkdtemp(join(os.tmpdir(), "markos-cli-split-theme-"));
    const projectRoot = join(tempRoot, "project");
    const outDir = join(projectRoot, "dist");
    const themesRoot = getBundledThemesRoot();
    const themeName = `split-theme-${Date.now()}`;
    const themeDirPath = join(themesRoot, themeName);

    try {
        await mkdir(projectRoot, {recursive: true});
        await mkdir(themeDirPath, {recursive: true});

        await writeFile(
            join(projectRoot, "slides.md"),
            [
                "---",
                `theme: ${themeName}`,
                "title: Split Theme Deck",
                "---",
                "",
                "# Hello Split Theme",
            ].join("\n"),
            "utf8",
        );
        await writeFile(
            join(themeDirPath, "theme.css"),
            [
                '@import "./tokens.css";',
                '@import "./base.css";',
                '@import "./shell.css";',
                "",
            ].join("\n"),
            "utf8",
        );
        await writeFile(
            join(themeDirPath, "tokens.css"),
            ":root { --split-theme-accent: #0a7a4b; }\n",
            "utf8",
        );
        await writeFile(
            join(themeDirPath, "base.css"),
            ".slidev-layout { letter-spacing: 0.01em; }\n",
            "utf8",
        );
        await writeFile(
            join(themeDirPath, "shell.css"),
            ".slidev-layout h1 { color: var(--split-theme-accent); }\n",
            "utf8",
        );
        await writeFile(
            join(themeDirPath, "README.md"),
            `# ${themeName}\n\n- Shell: slide-shell\n`,
            "utf8",
        );

        const result = await runCli([
            "build",
            projectRoot,
            "--out-dir",
            outDir,
        ]);

        const html = await readFile(join(outDir, "index.html"), "utf8");

        assert.equal(result.ok, true);
        assert.match(html, /Split Theme Deck/);
        assert.match(html, /Hello Split Theme/);
        assert.match(html, /--split-theme-accent: #0a7a4b;/);
        assert.match(html, /\.slidev-layout h1 \{ color: var\(--split-theme-accent\); \}/);
        assert.doesNotMatch(html, /@import "\.\/tokens\.css"/);
    } finally {
        await rm(themeDirPath, {recursive: true, force: true}).catch(() => {
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

test("CLI build auto-loads overrides.css after slides.css without an explicit import", async () => {
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
        await writeFile(join(deckRoot, "overrides.css"), ".cascade-target { color: green; }\n", "utf8");

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
            () => readFile(join(outDir, "overrides.css"), "utf8"),
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
    const themeDirPath = join(themesRoot, themeName);
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
        await writeDirectoryTheme(themesRoot, themeName, ".theme-dev { color: blue; }\n");
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
        ], {
            openUrlInBrowser: async () => {
            },
        });

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
        await rm(themeDirPath, {recursive: true, force: true}).catch(() => {
        });
        await rm(tempRoot, {recursive: true, force: true});
    }
});

test("CLI parseCliArgs accepts --open for dev", () => {
    const parsed = parseCliArgs([
        "dev",
        "examples/tokyo3days",
        "--port",
        "0",
        "--open",
    ]);

    assert.equal(parsed.command, "dev");
    assert.equal(parsed.entry, "examples/tokyo3days");
    assert.equal(parsed.port, 0);
    assert.equal(parsed.open, true);
});

test("CLI parseCliArgs accepts --no-open for dev", () => {
    const parsed = parseCliArgs([
        "dev",
        "examples/tokyo3days",
        "--no-open",
    ]);

    assert.equal(parsed.command, "dev");
    assert.equal(parsed.entry, "examples/tokyo3days");
    assert.equal(parsed.open, false);
});

test("CLI dev opens the browser by default", async () => {
    const tempRoot = await mkdtemp(join(os.tmpdir(), "markos-cli-dev-open-"));
    const projectRoot = join(tempRoot, "project");
    const outDir = join(projectRoot, ".markos-dev");
    let result = null;
    let openedUrl = "";

    try {
        await mkdir(projectRoot, {recursive: true});
        await writeFile(
            join(projectRoot, "slides.md"),
            [
                "---",
                "theme: Clay",
                "title: CLI Open Deck",
                "---",
                "",
                "# Hello Open",
            ].join("\n"),
            "utf8",
        );

        result = await runCli([
            "dev",
            projectRoot,
            "--out-dir",
            outDir,
            "--port",
            "0",
        ], {
            openUrlInBrowser: async (url) => {
                openedUrl = url;
            },
        });

        assert.equal(result.ok, true);
        assert.equal(result.command, "dev");
        assert.equal(openedUrl, result.url);
    } finally {
        await result?.stop?.().catch(() => {
        });
        await rm(tempRoot, {recursive: true, force: true});
    }
});

test("CLI dev skips opening the browser with --no-open", async () => {
    const tempRoot = await mkdtemp(join(os.tmpdir(), "markos-cli-dev-no-open-"));
    const projectRoot = join(tempRoot, "project");
    const outDir = join(projectRoot, ".markos-dev");
    let result = null;
    let opened = false;

    try {
        await mkdir(projectRoot, {recursive: true});
        await writeFile(
            join(projectRoot, "slides.md"),
            [
                "---",
                "theme: Clay",
                "title: CLI No Open Deck",
                "---",
                "",
                "# Hello No Open",
            ].join("\n"),
            "utf8",
        );

        result = await runCli([
            "dev",
            projectRoot,
            "--out-dir",
            outDir,
            "--port",
            "0",
            "--no-open",
        ], {
            openUrlInBrowser: async () => {
                opened = true;
            },
        });

        assert.equal(result.ok, true);
        assert.equal(opened, false);
    } finally {
        await result?.stop?.().catch(() => {
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
    const themeDirPath = join(themesRoot, themeName);
    const themeFilePath = join(themeDirPath, MARKOS_THEME_ENTRY_FILENAME);
    let result = null;

    try {
        await mkdir(projectRoot, {recursive: true});
        await writeDirectoryTheme(themesRoot, themeName, ".theme-version-a { color: blue; }\n");
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

        result = await runCli([
            "dev",
            projectRoot,
            "--out-dir",
            outDir,
            "--port",
            "0",
        ], {
            openUrlInBrowser: async () => {
            },
        });

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
        await rm(themeDirPath, {recursive: true, force: true}).catch(() => {
        });
        await rm(tempRoot, {recursive: true, force: true});
    }
});

test("CLI export command generates a PDF artifact through the real export pipeline", async () => {
    const tempRoot = await mkdtemp(join(os.tmpdir(), "markos-cli-export-"));
    const projectRoot = join(tempRoot, "project");
    const outDir = join(tempRoot, "pdf");
    const fakeBrowserPath = join(tempRoot, "fake-export-browser");
    const browserLogPath = join(tempRoot, "browser.log");
    const previousBrowser = process.env.MARKOS_EXPORT_BROWSER;
    const previousBrowserLog = process.env.MARKOS_TEST_EXPORT_BROWSER_LOG;

    try {
        await mkdir(projectRoot, {recursive: true});
        await writeFile(
            join(projectRoot, "slides.md"),
            [
                "---",
                "title: Export Deck",
                "---",
                "",
                "# Hello Export",
                "",
                "## Summary",
                "",
                "- One",
                "- Two",
            ].join("\n"),
            "utf8",
        );
        await writeFakeExportBrowser(fakeBrowserPath);
        process.env.MARKOS_EXPORT_BROWSER = fakeBrowserPath;
        process.env.MARKOS_TEST_EXPORT_BROWSER_LOG = browserLogPath;

        const result = await runCli([
            "export",
            projectRoot,
            "--format",
            "pdf",
            "--out-dir",
            outDir,
            "--file-name",
            "export-deck",
        ]);

        const artifactContents = await readFile(result.artifactFilePath, "utf8");
        const browserLog = await readFile(browserLogPath, "utf8");

        assert.equal(result.ok, true);
        assert.equal(result.command, "export");
        assert.equal(result.format, "pdf");
        assert.equal(result.fileName, "export-deck.pdf");
        assert.match(artifactContents, /%PDF-1.4/);
        assert.match(browserLog, /--print-to-pdf=/);
        assert.match(browserLog, /\/export\/$/m);
        await assert.rejects(
            () => stat(join(outDir, "__markos-export-site__")),
            /ENOENT/,
        );
        await assert.rejects(
            () => stat(join(projectRoot, ".markos-work")),
            /ENOENT/,
        );
    } finally {
        if (previousBrowser == null) {
            delete process.env.MARKOS_EXPORT_BROWSER;
        } else {
            process.env.MARKOS_EXPORT_BROWSER = previousBrowser;
        }
        if (previousBrowserLog == null) {
            delete process.env.MARKOS_TEST_EXPORT_BROWSER_LOG;
        } else {
            process.env.MARKOS_TEST_EXPORT_BROWSER_LOG = previousBrowserLog;
        }
        await rm(tempRoot, {recursive: true, force: true});
    }
});

test("CLI export command generates a PPTX artifact through the DOM export pipeline", async () => {
    const tempRoot = await mkdtemp(join(os.tmpdir(), "markos-cli-export-pptx-"));
    const projectRoot = join(tempRoot, "project");
    const outDir = join(tempRoot, "pptx");
    const previousExportModel = process.env.MARKOS_TEST_EXPORT_MODEL_JSON;

    try {
        await mkdir(projectRoot, {recursive: true});
        await writeFile(
            join(projectRoot, "slides.md"),
            [
                "---",
                "title: Export Deck",
                "---",
                "",
                "# Hello Export",
                "",
                "Summary line for export.",
            ].join("\n"),
            "utf8",
        );
        process.env.MARKOS_TEST_EXPORT_MODEL_JSON = JSON.stringify({
            deck: {
                title: "Export Deck",
                width: 1280,
                height: 720,
            },
            slides: [
                {
                    index: 0,
                    title: "Hello Export",
                    template: "default",
                    backgroundColor: "rgb(255, 255, 255)",
                    nodes: [
                        {
                            id: "slide-1.title",
                            kind: "text",
                            role: "title",
                            layer: 3,
                            order: 1,
                            x: 72,
                            y: 60,
                            w: 1136,
                            h: 56,
                            text: "Hello Export",
                            fontFamily: "Arial",
                            fontSizePx: 42,
                            fontWeight: "700",
                            fontStyle: "normal",
                            textAlign: "left",
                            color: "rgb(17, 24, 39)",
                        },
                    ],
                },
            ],
        });

        const result = await runCli([
            "export",
            projectRoot,
            "--format",
            "pptx",
            "--out-dir",
            outDir,
            "--file-name",
            "export-deck",
        ]);

        const artifactContents = await readFile(result.artifactFilePath);

        assert.equal(result.ok, true);
        assert.equal(result.command, "export");
        assert.equal(result.format, "pptx");
        assert.equal(result.fileName, "export-deck.pptx");
        assert.equal(String(artifactContents.subarray(0, 2)), "PK");
        await assert.rejects(
            () => stat(join(outDir, "__markos-export-site__")),
            /ENOENT/,
        );
        await assert.rejects(
            () => stat(join(projectRoot, ".markos-work")),
            /ENOENT/,
        );
    } finally {
        if (previousExportModel == null) {
            delete process.env.MARKOS_TEST_EXPORT_MODEL_JSON;
        } else {
            process.env.MARKOS_TEST_EXPORT_MODEL_JSON = previousExportModel;
        }
        await rm(tempRoot, {recursive: true, force: true});
    }
});

test("CLI theme apply writes file-level theme metadata and preserves deck-local overrides", async () => {
    const tempRoot = await mkdtemp(join(os.tmpdir(), "markos-theme-"));
    const deckRoot = join(tempRoot, "deck");
    const themesRoot = getBundledThemesRoot();
    const themeName = `test-theme-${Date.now()}`;
    const themeDirPath = join(themesRoot, themeName);

    try {
        await mkdir(deckRoot, {recursive: true});
        await mkdir(themesRoot, {recursive: true});
        await writeFile(join(deckRoot, "slides.md"), "# Deck\n", "utf8");
        await writeFile(join(deckRoot, "slides.css"), ".old { color: blue; }\n", "utf8");
        await writeDirectoryTheme(themesRoot, themeName, ".theme { color: red; }\n");

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
        await rm(themeDirPath, {recursive: true, force: true}).catch(() => {
        });
        await rm(tempRoot, {recursive: true, force: true});
    }
});

test("CLI theme apply inserts a separate file-frontmatter block above an old first-slide block", async () => {
    const tempRoot = await mkdtemp(join(os.tmpdir(), "markos-theme-legacy-"));
    const deckRoot = join(tempRoot, "deck");
    const themesRoot = getBundledThemesRoot();
    const themeName = `legacy-theme-${Date.now()}`;
    const themeDirPath = join(themesRoot, themeName);

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
        await writeDirectoryTheme(themesRoot, themeName, ".theme { color: red; }\n");

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
        await rm(themeDirPath, {recursive: true, force: true}).catch(() => {
        });
        await rm(tempRoot, {recursive: true, force: true});
    }
});

test("CLI build rejects legacy single-file themes outside a theme folder", async () => {
    const tempRoot = await mkdtemp(join(os.tmpdir(), "markos-cli-legacy-theme-"));
    const projectRoot = join(tempRoot, "project");
    const outDir = join(projectRoot, "dist");
    const themesRoot = getBundledThemesRoot();
    const themeName = `legacy-build-theme-${Date.now()}`;
    const themeFilePath = join(themesRoot, `${themeName}.css`);

    try {
        await mkdir(projectRoot, {recursive: true});
        await mkdir(themesRoot, {recursive: true});

        await writeFile(
            join(projectRoot, "slides.md"),
            [
                "---",
                `theme: ${themeName}`,
                "title: Legacy Theme Deck",
                "---",
                "",
                "# Legacy Theme",
            ].join("\n"),
            "utf8",
        );
        await writeFile(themeFilePath, ".legacy-theme { color: rebeccapurple; }\n", "utf8");

        await assert.rejects(
            () => runCli([
                "build",
                projectRoot,
                "--out-dir",
                outDir,
            ]),
            new RegExp(`Theme not found: ${themeName}`),
        );
    } finally {
        await rm(themeFilePath, {force: true}).catch(() => {
        });
        await rm(tempRoot, {recursive: true, force: true});
    }
});

test("CLI build rejects file-level theme names that include a .css suffix", async () => {
    const tempRoot = await mkdtemp(join(os.tmpdir(), "markos-cli-theme-suffix-"));
    const projectRoot = join(tempRoot, "project");
    const outDir = join(projectRoot, "dist");
    const themesRoot = getBundledThemesRoot();
    const themeName = `suffix-theme-${Date.now()}`;
    const themeDirPath = join(themesRoot, themeName);

    try {
        await mkdir(projectRoot, {recursive: true});
        await mkdir(themesRoot, {recursive: true});
        await writeDirectoryTheme(themesRoot, themeName, ".theme-suffix { color: blue; }\n");
        await writeFile(
            join(projectRoot, "slides.md"),
            [
                "---",
                `theme: ${themeName}.css`,
                "title: Invalid Theme Name",
                "---",
                "",
                "# Invalid Theme Name",
            ].join("\n"),
            "utf8",
        );

        await assert.rejects(
            () => runCli([
                "build",
                projectRoot,
                "--out-dir",
                outDir,
            ]),
            /Theme name must not include the \.css suffix/,
        );
    } finally {
        await rm(themeDirPath, {recursive: true, force: true}).catch(() => {
        });
        await rm(tempRoot, {recursive: true, force: true});
    }
});

test("CLI theme apply rejects theme arguments that include a .css suffix", async () => {
    const tempRoot = await mkdtemp(join(os.tmpdir(), "markos-theme-apply-suffix-"));
    const deckRoot = join(tempRoot, "deck");

    try {
        await mkdir(deckRoot, {recursive: true});
        await writeFile(join(deckRoot, "slides.md"), "# Deck\n", "utf8");

        await assert.rejects(
            () => runCli([
                "theme",
                "apply",
                "Clay.css",
                deckRoot,
            ]),
            /Theme name must not include the \.css suffix/,
        );
    } finally {
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

test("CLI theme preview serves a theme fixture through the real dev pipeline", async () => {
    const themesRoot = getBundledThemesRoot();
    const themeName = `preview-theme-${process.pid}-${Date.now()}`;
    const themeDirPath = join(themesRoot, themeName);
    const fixtureDirPath = join(themeDirPath, "fixtures");
    const fixtureFilePath = join(fixtureDirPath, "comparison.md");
    let result = null;
    let opened = false;

    try {
        await mkdir(fixtureDirPath, {recursive: true});
        await writeDirectoryTheme(themesRoot, themeName, ".preview-theme { color: blue; }\n");
        await writeFile(
            fixtureFilePath,
            [
                "---",
                `theme: ${themeName}`,
                "title: Theme Preview Fixture",
                "---",
                "",
                "---",
                "layout: two-cols",
                "layoutClass: slide-shell comparison-slide",
                "---",
                "",
                "# Fixture Heading",
                "",
                "> Left Panel",
                "",
                "::right::",
                "",
                "## Right Panel",
                "",
                "Fixture body.",
            ].join("\n"),
            "utf8",
        );

        result = await runCli([
            "theme",
            "preview",
            themeName,
            "comparison",
            "--port",
            "0",
            "--no-open",
        ], {
            openUrlInBrowser: async () => {
                opened = true;
            },
        });

        const firstHtml = await fetch(`${result.url}?slide=1`).then((response) => response.text());

        assert.equal(result.ok, true);
        assert.equal(result.command, "theme");
        assert.equal(result.action, "preview");
        assert.equal(result.themeName, themeName);
        assert.equal(result.fixtureName, "comparison");
        assert.equal(opened, false);
        assert.match(firstHtml, /Fixture Heading/);
        assert.match(firstHtml, /Right Panel/);
        assert.match(firstHtml, /\.preview-theme \{ color: blue; \}/);

        await writeFile(
            fixtureFilePath,
            [
                "---",
                `theme: ${themeName}`,
                "title: Theme Preview Fixture",
                "---",
                "",
                "---",
                "layout: two-cols",
                "layoutClass: slide-shell comparison-slide",
                "---",
                "",
                "# Updated Fixture Heading",
                "",
                "> Left Panel",
                "",
                "::right::",
                "",
                "## Right Panel",
                "",
                "Updated fixture body.",
            ].join("\n"),
            "utf8",
        );

        const updatedHtml = await waitForHtml(
            `${result.url}?slide=1`,
            (html) => html.includes("Updated Fixture Heading"),
        );

        assert.match(updatedHtml, /Updated Fixture Heading/);
        assert.match(updatedHtml, /Updated fixture body\./);
    } finally {
        await result?.stop?.().catch(() => {
        });
        await rm(themeDirPath, {recursive: true, force: true}).catch(() => {
        });
    }
});
