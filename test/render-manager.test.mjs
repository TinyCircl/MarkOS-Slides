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

test("source-file mode keeps sibling CSS files and entry-local references", () => {
    const files = createInlineSourceFiles({
        title: "demo",
        entry: "slides.md",
        source: {
            files: [
                {
                    path: "slides.md",
                    content: [
                        "![Alt](./image.png)",
                        "",
                        "<MyWidget />",
                    ].join("\n"),
                },
                {
                    path: "slides.css",
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
    const siblingCss = files.find((file) => file.path === "slides.css");
    assert.ok(entry);
    assert.equal(typeof entry.content, "string");
    assert.ok(siblingCss);
    assert.equal(typeof siblingCss.content, "string");
    assert.match(entry.content, /!\[Alt]\(\.\/image\.png\)/);
    assert.match(entry.content, /<MyWidget \/>/);
    assert.equal(files.find((file) => file.path === "styles/index.css"), undefined);
});

test("authoring mode keeps local resource references for single-file decks", () => {
    const files = createInlineSourceFiles({
        title: "demo",
        content: [
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
    assert.match(entry.content, /!\[Alt]\(\.\/image\.png\)/);
    assert.match(entry.content, /<MyWidget \/>/);
    assert.match(entry.content, /<video src="\.\/*demo\.mp4"><\/video>/);
});

test("css frontmatter no longer creates generated compatibility files", () => {
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
    assert.match(entry.content, /css:\s*\[styles\/theme\.css\]/);
    assert.equal(stylesIndex, undefined);
});
