import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import {mkdir, mkdtemp, rm, writeFile} from "node:fs/promises";
import {join} from "node:path";
import {markosWebRenderEngine} from "../src/engines/markos-web/index.mjs";

test("markos-web rejects unsupported artifact exports", async () => {
    const tempRoot = await mkdtemp(join(os.tmpdir(), "markos-export-"));
    const workDir = join(tempRoot, "work");

    try {
        await mkdir(workDir, {recursive: true});
        const entryFilePath = join(workDir, "slides.md");
        await writeFile(entryFilePath, "# Demo", "utf8");

        await assert.rejects(
            () => markosWebRenderEngine.exportArtifact({
                entryFilePath,
                format: "svg",
                outputFilePath: join(tempRoot, "demo.svg"),
                cwd: workDir,
            }),
            /Supported formats: "web", "pdf", "pptx"/,
        );
    } finally {
        await rm(tempRoot, {recursive: true, force: true});
    }
});
