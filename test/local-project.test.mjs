import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import {mkdir, mkdtemp, rm, writeFile} from "node:fs/promises";
import {join} from "node:path";
import {createLocalProjectInput} from "../src/core/index.mjs";

test("createLocalProjectInput reads slides.md plus recognized deck CSS layers", async () => {
    const tempRoot = await mkdtemp(join(os.tmpdir(), "markos-local-project-"));
    const projectRoot = join(tempRoot, "project");
    const outDir = join(projectRoot, "dist");

    try {
        await mkdir(outDir, {recursive: true});

        await writeFile(join(projectRoot, "slides.md"), "# Hello Local Project\n", "utf8");
        await writeFile(join(projectRoot, "slides.css"), ".accent { color: red; }\n", "utf8");
        await writeFile(join(projectRoot, "overrides.css"), ".agent { color: green; }\n", "utf8");
        await writeFile(join(projectRoot, "notes.txt"), "ignore me\n", "utf8");
        await writeFile(join(projectRoot, "logo.svg"), "<svg></svg>\n", "utf8");
        await writeFile(join(outDir, "stale.txt"), "should be ignored\n", "utf8");

        const input = await createLocalProjectInput({
            entryFilePath: join(projectRoot, "slides.md"),
            ignoredPaths: [outDir],
        });

        assert.equal(input.title, "slides");
        assert.equal(input.entry, "slides.md");

        const slideEntry = input.source.files.find((file) => file.path === "slides.md");
        const styleEntry = input.source.files.find((file) => file.path === "slides.css");
        const overrideStyleEntry = input.source.files.find((file) => file.path === "overrides.css");
        const staleOutput = input.source.files.find((file) => file.path === "dist/stale.txt");
        const notesEntry = input.source.files.find((file) => file.path === "notes.txt");
        const logoEntry = input.source.files.find((file) => file.path === "logo.svg");

        assert.ok(slideEntry);
        assert.equal(typeof slideEntry.content, "string");
        assert.ok(styleEntry);
        assert.equal(typeof styleEntry.content, "string");
        assert.ok(overrideStyleEntry);
        assert.equal(typeof overrideStyleEntry.content, "string");
        assert.equal(staleOutput, undefined);
        assert.equal(notesEntry, undefined);
        assert.equal(logoEntry, undefined);
        assert.equal(input.source.files.length, 3);
    } finally {
        await rm(tempRoot, {recursive: true, force: true});
    }
});
