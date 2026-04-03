import {mkdtemp, readFile, rm} from "node:fs/promises";
import os from "node:os";
import {join} from "node:path";
import {runCli} from "../src/cli/index.mjs";

const repoRoot = process.cwd();

const EXAMPLES = [
  {
    name: "basic",
    entry: join(repoRoot, "examples", "basic", "slides.md"),
    expectedFiles: [
      "index.html",
      "assets/markdos-icon.svg",
    ],
  },
  {
    name: "project",
    entry: join(repoRoot, "examples", "project", "slides.md"),
    expectedFiles: [
      "index.html",
      "assets/markdos-icon.svg",
    ],
  },
];

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

const results = [];
for (const example of EXAMPLES) {
  results.push(await verifyExample(example));
}

console.log(JSON.stringify({
  ok: true,
  checked: results.map((item) => item.name),
}, null, 2));
