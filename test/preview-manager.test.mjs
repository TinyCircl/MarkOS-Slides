import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {join} from "node:path";
import {disposePreviewSession, ensurePreviewSession, getPreviewSession} from "../src/preview-manager.mjs";

test("preview sessions build a static site for the current engine", async () => {
  const preview = await ensurePreviewSession({
    projectId: `proj-${Date.now()}`,
    cacheKey: `cache-${Math.random()}`,
    documentId: String(Date.now()),
    title: "Preview Deck",
    content: "# Preview Body",
  });

  try {
    assert.match(preview.basePath, /^\/preview\/[a-f0-9]{12}\/$/);
    assert.equal(preview.slidesPath, preview.basePath);
    assert.equal(preview.presenterPath, `${preview.basePath}presenter`);
    assert.equal(preview.overviewPath, `${preview.basePath}overview`);

    const session = getPreviewSession(preview.sessionId);
    assert.ok(session);
    assert.equal(session.ready, true);

    const html = await readFile(join(session.outputDir, "index.html"), "utf8");
    assert.match(html, /Preview Deck/);
    assert.match(html, /Preview Body/);
    assert.match(html, /"basePath":"\/preview\//);
  } finally {
    await disposePreviewSession(preview.sessionId);
  }
});
