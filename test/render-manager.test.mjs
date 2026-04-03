import test from "node:test";
import assert from "node:assert/strict";
import { MARKOS_SOURCE_MODES, buildDeckMarkdown, createInlineSourceFiles } from "../src/core/index.mjs";

test("legacy single-file decks still strip local resource references", () => {
    const markdown = buildDeckMarkdown({
        title: "demo",
        content: [
            "---",
            "css: ./styles.css",
            "---",
            "",
            "![Alt](./image.png)",
            "",
            "<MyWidget />",
            "",
            "<video src=\"./demo.mp4\"></video>",
            "",
            "```ts {monaco}",
            "console.log(1)",
            "```",
        ].join("\n"),
    });

    assert.match(markdown, /css: \.\/styles\.css/);
    assert.doesNotMatch(markdown, /!\[Alt]\(\.\/image\.png\)/);
    assert.doesNotMatch(markdown, /<MyWidget \/>/);
    assert.doesNotMatch(markdown, /<video src="\.\/*demo\.mp4"><\/video>/);
    assert.doesNotMatch(markdown, /\{monaco\}/);
});

test("folder-style source keeps entry-local CSS and component references", () => {
    const files = createInlineSourceFiles({
        title: "demo",
        entry: "slides.md",
        source: {
            files: [
                {
                    path: "slides.md",
                    content: [
                        "---",
                        "css: ./styles.css",
                        "---",
                        "",
                        "![Alt](./image.png)",
                        "",
                        "<MyWidget />",
                    ].join("\n"),
                },
                {
                    path: "styles.css",
                    content: ".slidev-layout { color: red; }",
                },
                {
                    path: "components/MyWidget.vue",
                    content: "<template><div>widget</div></template>",
                },
            ],
        },
    });

    const entry = files.find((file) => file.path === "slides.md");
    const stylesIndex = files.find((file) => file.path === "styles/index.css");
    assert.ok(entry);
    assert.equal(typeof entry.content, "string");
    assert.ok(stylesIndex);
    assert.equal(typeof stylesIndex.content, "string");
    assert.match(stylesIndex.content, /@import "\.\.\/styles\.css";/);
    assert.match(entry.content, /!\[Alt]\(\.\/image\.png\)/);
    assert.match(entry.content, /<MyWidget \/>/);
    assert.doesNotMatch(entry.content, /css: \.\/styles\.css/);
});

test("authoring mode keeps local resource references for single-file decks", () => {
    const files = createInlineSourceFiles({
        title: "demo",
        content: [
            "---",
            "css: ./styles.css",
            "---",
            "",
            "![Alt](./image.png)",
            "",
            "<MyWidget />",
            "",
            "<video src=\"./demo.mp4\"></video>",
        ].join("\n"),
    }, {
        mode: MARKOS_SOURCE_MODES.AUTHORING,
    });

    const entry = files.find((file) => file.path === "slides.md");
    assert.ok(entry);
    assert.equal(typeof entry.content, "string");
    assert.match(entry.content, /css: \.\/styles\.css/);
    assert.match(entry.content, /!\[Alt]\(\.\/image\.png\)/);
    assert.match(entry.content, /<MyWidget \/>/);
    assert.match(entry.content, /<video src="\.\/*demo\.mp4"><\/video>/);
});

test("legacy css frontmatter paths are rewritten to auto-loaded styles index", () => {
    const files = createInlineSourceFiles({
        title: "demo",
        entry: "slides.md",
        source: {
            files: [
                {
                    path: "slides.md",
                    content: [
                        "---",
                        "css: [styles/theme.css]",
                        "---",
                        "",
                        "# Hello",
                    ].join("\n"),
                },
                {
                    path: "styles/theme.css",
                    content: ".accent { color: #f06b1f; }",
                },
            ],
        },
    });

    const entry = files.find((file) => file.path === "slides.md");
    const stylesIndex = files.find((file) => file.path === "styles/index.css");

    assert.ok(entry);
    assert.equal(typeof entry.content, "string");
    assert.doesNotMatch(entry.content, /css:\s*\[styles\/theme\.css\]/);

    assert.ok(stylesIndex);
    assert.equal(typeof stylesIndex.content, "string");
    assert.match(stylesIndex.content, /@import "\.\/theme\.css";/);
});
