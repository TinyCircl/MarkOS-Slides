import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import {mkdir, mkdtemp, rm, writeFile} from "node:fs/promises";
import {join} from "node:path";
import {createLocalProjectInput} from "../src/core/index.mjs";

test("createLocalProjectInput reads a local slide project and ignores build output paths", async () => {
    const tempRoot = await mkdtemp(join(os.tmpdir(), "markos-local-project-"));
    const projectRoot = join(tempRoot, "project");
    const outDir = join(projectRoot, "dist");

    try {
        await mkdir(join(projectRoot, "styles"), {recursive: true});
        await mkdir(join(projectRoot, "assets"), {recursive: true});
        await mkdir(outDir, {recursive: true});

        await writeFile(join(projectRoot, "slides.md"), "# Hello Local Project\n", "utf8");
        await writeFile(join(projectRoot, "styles", "index.css"), ".accent { color: red; }\n", "utf8");
        await writeFile(join(projectRoot, "assets", "logo.png"), Buffer.from([0, 1, 2, 3]));
        await writeFile(join(outDir, "stale.txt"), "should be ignored\n", "utf8");

        const input = await createLocalProjectInput({
            entryFilePath: join(projectRoot, "slides.md"),
            ignoredPaths: [outDir],
        });

        assert.equal(input.title, "slides");
        assert.equal(input.entry, "slides.md");

        const slideEntry = input.source.files.find((file) => file.path === "slides.md");
        const styleEntry = input.source.files.find((file) => file.path === "styles/index.css");
        const assetEntry = input.source.files.find((file) => file.path === "assets/logo.png");
        const staleOutput = input.source.files.find((file) => file.path === "dist/stale.txt");

        assert.ok(slideEntry);
        assert.equal(typeof slideEntry.content, "string");
        assert.ok(styleEntry);
        assert.equal(typeof styleEntry.content, "string");
        assert.ok(assetEntry);
        assert.equal(typeof assetEntry.contentBase64, "string");
        assert.equal(staleOutput, undefined);
    } finally {
        await rm(tempRoot, {recursive: true, force: true});
    }
});
