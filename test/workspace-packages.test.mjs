import test from "node:test";
import assert from "node:assert/strict";
import * as coreWorkspace from "../packages/core/index.mjs";
import * as cliWorkspace from "../packages/cli/index.mjs";
import * as serverWorkspace from "../packages/server/index.mjs";

test("workspace packages expose the expected core, cli, and server entrypoints", () => {
  assert.equal(typeof coreWorkspace.buildStaticSiteFromInput, "function");
  assert.equal(typeof coreWorkspace.createLocalProjectInput, "function");
  assert.equal(typeof cliWorkspace.parseCliArgs, "function");
  assert.equal(typeof cliWorkspace.runCli, "function");
  assert.equal(typeof serverWorkspace.startServer, "function");
  assert.equal(typeof serverWorkspace.startGrpcServer, "function");
});
