import test from "node:test";
import assert from "node:assert/strict";
import {DEFAULT_RENDER_ENGINE, resolveRenderEngine} from "../src/engines/index.mjs";

test("default render engine resolves to markos-web", () => {
    const engine = resolveRenderEngine();
    assert.equal(DEFAULT_RENDER_ENGINE, "markos-web");
    assert.equal(engine.name, "markos-web");
});

test("unknown render engines fail fast", () => {
    assert.throws(
        () => resolveRenderEngine("markos-next"),
        /Unsupported render engine: markos-next/,
    );
});
