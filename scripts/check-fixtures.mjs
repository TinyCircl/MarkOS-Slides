import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDeckMarkdown } from "../src/render-manager.mjs";

const scriptDir = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const fixturesRoot = join(repoRoot, "test", "fixtures", "markdown");

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...walk(full));
    } else {
      out.push(full);
    }
  }
  return out;
}

function toRelative(path) {
  return relative(fixturesRoot, path).replace(/\\/g, "/");
}

const RE_MARKDOWN_PATH_IMAGE = /!\[[^\]]*]\((?!https?:|mailto:|tel:|data:|blob:|#|\/\/)([^)]+)\)/g;
const RE_HTML_PATH_SRC = /<(img|video|audio|source|iframe|embed)\b[^>]*\bsrc\s*=\s*(['"]?)(?!https?:|data:|blob:|#|\/\/)([^\s'">]+)\2/gi;
const RE_HTML_PATH_DATA = /<object\b[^>]*\bdata\s*=\s*(['"]?)(?!https?:|data:|blob:|#|\/\/)([^\s'">]+)\1/gi;
const RE_SNIPPET_PATH = /^\s*<<<\s+(?!https?:\/\/)(.+)$/gm;
const RE_SELF_CLOSING_CUSTOM = /<([A-Z][\w]*|[a-z][\w]*(?:-[\w-]+)+)\b[^>]*\/>/g;
const RE_CUSTOM_PAIR = /<([A-Z][\w]*|[a-z][\w]*(?:-[\w-]+)+)\b[^>]*>/g;

const BUILTIN_COMPONENT_ALLOWLIST = new Set([
  "RenderWhen",
  "LightOrDark",
  "Toc",
  "Tweet",
  "Link",
  "Arrow",
]);

const files = walk(fixturesRoot).filter((file) => {
  const extension = extname(file).toLowerCase();
  return extension === ".md" || extension === ".txt";
});

const pathFailures = [];
const componentFindings = [];

for (const file of files) {
  const input = readFileSync(file, "utf8");
  const output = buildDeckMarkdown({
    title: toRelative(file),
    content: input,
  });

  const pathIssues = {
    markdownPathImages: [...output.matchAll(RE_MARKDOWN_PATH_IMAGE)].map((match) => match[1]),
    htmlPathSrcs: [...output.matchAll(RE_HTML_PATH_SRC)].map((match) => match[3]),
    htmlPathDatas: [...output.matchAll(RE_HTML_PATH_DATA)].map((match) => match[2]),
    snippetPaths: [...output.matchAll(RE_SNIPPET_PATH)].map((match) => match[1].trim()),
  };

  if (Object.values(pathIssues).some((items) => items.length > 0)) {
    pathFailures.push({
      file: toRelative(file),
      issues: pathIssues,
    });
  }

  const customTags = [
    ...[...output.matchAll(RE_SELF_CLOSING_CUSTOM)].map((match) => match[1]),
    ...[...output.matchAll(RE_CUSTOM_PAIR)].map((match) => match[1]),
  ].filter((name) => !BUILTIN_COMPONENT_ALLOWLIST.has(name));

  if (customTags.length > 0) {
    componentFindings.push({
      file: toRelative(file),
      tags: [...new Set(customTags)].sort(),
    });
  }
}

const report = {
  fixturesRoot: relative(scriptDir, fixturesRoot).replace(/\\/g, "/"),
  total: files.length,
  pathRulePassed: files.length - pathFailures.length,
  pathRuleFailed: pathFailures.length,
  pathFailures,
  componentFindings,
};

console.log(JSON.stringify(report, null, 2));

if (pathFailures.length > 0) {
  process.exitCode = 1;
}
