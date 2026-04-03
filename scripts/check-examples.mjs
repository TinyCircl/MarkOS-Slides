import {mkdtemp, readFile, readdir, rm, stat} from "node:fs/promises";
import os from "node:os";
import {join} from "node:path";
import {runCli} from "../src/cli/index.mjs";

const repoRoot = process.cwd();
const examplesRoot = join(repoRoot, "examples");

async function pathExists(targetPath) {
  try {
    await stat(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function discoverExamples() {
  const entries = await readdir(examplesRoot, {withFileTypes: true});
  const examples = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) {
      continue;
    }

    const exampleRoot = join(examplesRoot, entry.name);
    const slidesPath = join(exampleRoot, "slides.md");
    const cssPath = join(exampleRoot, "slides.css");

    if (!await pathExists(slidesPath)) {
      continue;
    }

    if (!await pathExists(cssPath)) {
      throw new Error(`Example deck is missing slides.css: ${exampleRoot}`);
    }

    examples.push({
      name: entry.name,
      entry: exampleRoot,
      expectedFiles: [
        "index.html",
        "assets/markdos-icon.svg",
      ],
    });
  }

  if (examples.length === 0) {
    throw new Error(`No example decks found in ${examplesRoot}`);
  }

  return examples.sort((left, right) => left.name.localeCompare(right.name));
}

async function verifyExample(example) {
  const tempRoot = await mkdtemp(join(os.tmpdir(), `markos-example-${example.name}-`));
  const outDir = join(tempRoot, "dist");

  try {
    await runCli([
      "build",
      example.entry,
      "--out-dir",
      outDir,
    ]);

    for (const relativePath of example.expectedFiles) {
      await readFile(join(outDir, relativePath), "utf8");
    }

    return {
      name: example.name,
      ok: true,
      outDir,
    };
  } finally {
    await rm(tempRoot, {recursive: true, force: true}).catch(() => {
    });
  }
}

const EXAMPLES = await discoverExamples();
const results = [];
for (const example of EXAMPLES) {
  results.push(await verifyExample(example));
}

console.log(JSON.stringify({
  ok: true,
  checked: results.map((item) => item.name),
}, null, 2));
