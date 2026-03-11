import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, normalize } from "node:path";

const ARTIFACT_IDLE_TTL_MS = Number(process.env.SLIDEV_ARTIFACT_TTL_MS || 60 * 60 * 1000);

function normalizeText(value) {
  return value.replace(/\r\n?/g, "\n");
}

function normalizeTitle(title) {
  const trimmed = title?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : "Untitled Slides";
}

function buildDeckMarkdown(input) {
  const title = normalizeTitle(input.title);
  const content = normalizeText(input.content).trim();

  if (!content) {
    return [
      "---",
      `title: ${JSON.stringify(title)}`,
      "theme: default",
      "mdc: true",
      "---",
      "",
      `# ${title}`,
      "",
      "Start writing to generate slides.",
      "",
    ].join("\n");
  }

  if (content.startsWith("---")) {
    return `${content}\n`;
  }

  return [
    "---",
    `title: ${JSON.stringify(title)}`,
    "theme: default",
    "mdc: true",
    "---",
    "",
    content,
    "",
  ].join("\n");
}

function sanitizeRelativePath(relativePath) {
  const normalizedPath = normalize(relativePath)
    .replace(/^(\.\.(\/|\\|$))+/, "")
    .replace(/^[/\\]+/, "");
  if (!normalizedPath || normalizedPath.startsWith("..")) {
    throw new Error(`Invalid asset path: ${relativePath}`);
  }
  return normalizedPath;
}

function normalizeBasePath(basePath) {
  const trimmed = basePath?.trim();
  if (!trimmed) {
    throw new Error("Preview basePath is required.");
  }
  return `/${trimmed.replace(/^\/+|\/+$/g, "")}/`;
}

function getCliPath() {
  return join(process.cwd(), "node_modules", "@slidev", "cli", "bin", "slidev.mjs");
}

function getWorkDir(jobId) {
  return join(process.cwd(), ".slidev-workspaces", jobId);
}

function getArtifactDir(jobId) {
  return join(process.cwd(), ".slidev-artifacts", jobId);
}

function getPreviewArtifactDir(previewId) {
  return join(process.cwd(), ".slidev-artifacts", "previews", previewId);
}

async function writeAssets(rootDir, assets = []) {
  for (const asset of assets) {
    const relativePath = sanitizeRelativePath(asset.path);
    const targetPath = join(rootDir, relativePath);
    await mkdir(dirname(targetPath), { recursive: true });
    await writeFile(targetPath, Buffer.from(asset.contentBase64, "base64"));
  }
}

async function writeSourceFiles(rootDir, files = []) {
  for (const file of files) {
    const relativePath = sanitizeRelativePath(file.path);
    const targetPath = join(rootDir, relativePath);
    await mkdir(dirname(targetPath), { recursive: true });
    if (typeof file.content === "string") {
      await writeFile(targetPath, file.content, "utf8");
      continue;
    }
    await writeFile(targetPath, Buffer.from(file.contentBase64, "base64"));
  }
}

async function runSlidevCommand(args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [getCliPath(), ...args], {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }

      reject(new Error(`Slidev command failed with exit code ${code}.\n${stderr || stdout}`));
    });
  });
}

function scheduleArtifactCleanup(jobId) {
  setTimeout(() => {
    void rm(getWorkDir(jobId), { recursive: true, force: true }).catch(() => {});
    void rm(getArtifactDir(jobId), { recursive: true, force: true }).catch(() => {});
  }, ARTIFACT_IDLE_TTL_MS);
}

async function listRelativeFiles(rootDir, currentDir = rootDir) {
  const entries = await readdir(currentDir, { withFileTypes: true });
  const results = [];

  for (const entry of entries) {
    const absolutePath = join(currentDir, entry.name);
    if (entry.isDirectory()) {
      results.push(...await listRelativeFiles(rootDir, absolutePath));
      continue;
    }
    if (!entry.isFile()) {
      continue;
    }
    results.push(absolutePath.slice(rootDir.length + 1).replace(/\\/g, "/"));
  }

  return results.sort((left, right) => left.localeCompare(right));
}

function createInlineSourceFiles(input) {
  if (input.source?.files?.length) {
    return input.source.files.map((file) => {
      const relativePath = sanitizeRelativePath(file.path);
      if (typeof file.content === "string") {
        return {
          path: relativePath,
          content: file.content,
        };
      }
      return {
        path: relativePath,
        contentBase64: file.contentBase64,
      };
    });
  }

  const sourceEntry = sanitizeRelativePath(input.entry || "slides.md");
  const files = [
    {
      path: sourceEntry,
      content: buildDeckMarkdown(input),
    },
  ];

  for (const asset of input.assets ?? []) {
    files.push({
      path: sanitizeRelativePath(asset.path),
      contentBase64: asset.contentBase64,
    });
  }

  return files;
}

function ensureSourceEntryExists(files, sourceEntry) {
  const normalizedEntry = sanitizeRelativePath(sourceEntry);
  if (!files.some((file) => sanitizeRelativePath(file.path) === normalizedEntry)) {
    throw new Error(`Preview source entry file not found: ${normalizedEntry}`);
  }
  return normalizedEntry;
}

async function writePreviewManifest({ previewId, buildId, basePath, outputDir, sourceEntry }) {
  const files = await listRelativeFiles(outputDir);
  const manifest = {
    id: previewId,
    buildId,
    basePath,
    entry: "index.html",
    spaFallback: true,
    assetPrefixes: ["assets/"],
    privateFiles: ["manifest.json"],
    sourceEntry,
    files,
    createdAt: new Date().toISOString(),
  };

  const manifestFilePath = join(outputDir, "manifest.json");
  await writeFile(manifestFilePath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return {
    manifest,
    manifestFilePath,
  };
}

export async function renderArtifact(input) {
  const jobId = randomUUID();
  const workDir = getWorkDir(jobId);
  const artifactDir = getArtifactDir(jobId);
  const entryFilePath = join(workDir, "slides.md");

  await mkdir(workDir, { recursive: true });
  await mkdir(artifactDir, { recursive: true });
  await writeFile(entryFilePath, buildDeckMarkdown(input), "utf8");
  await writeAssets(workDir, input.assets ?? []);

  if (input.format === "web") {
    const outDir = join(artifactDir, "web");
    await runSlidevCommand(
      [
        "build",
        entryFilePath,
        "--out",
        outDir,
        "--base",
        `/artifacts/${jobId}/web/`,
      ],
      workDir,
    );

    scheduleArtifactCleanup(jobId);
    return {
      jobId,
      format: "web",
      artifactPath: `/artifacts/${jobId}/web/`,
      fileName: "index.html",
    };
  }

  const extension = input.format;
  const baseName = (input.fileName?.trim() || normalizeTitle(input.title)).replace(/[<>:"/\\|?*\x00-\x1F]/g, "_");
  const outputFileName = `${baseName}.${extension}`;
  const outputFilePath = join(artifactDir, outputFileName);

  await runSlidevCommand(
    [
      "export",
      entryFilePath,
      "--format",
      input.format,
      "--output",
      outputFilePath,
    ],
    workDir,
  );

  scheduleArtifactCleanup(jobId);
  return {
    jobId,
    format: input.format,
    artifactPath: `/artifacts/${jobId}/${outputFileName}`,
    fileName: outputFileName,
  };
}

export async function buildPreviewSite(input) {
  const previewId = input.previewId.trim();
  const buildId = randomUUID();
  const basePath = normalizeBasePath(input.basePath || `/p/${previewId}/`);
  const sourceFiles = createInlineSourceFiles(input);
  const sourceEntry = ensureSourceEntryExists(sourceFiles, input.entry || "slides.md");
  const workDir = getWorkDir(buildId);
  const outputDir = getPreviewArtifactDir(previewId);
  const entryFilePath = join(workDir, sourceEntry);

  await rm(workDir, { recursive: true, force: true });
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(workDir, { recursive: true });
  await mkdir(outputDir, { recursive: true });

  try {
    await writeSourceFiles(workDir, sourceFiles);
    await runSlidevCommand(
      [
        "build",
        entryFilePath,
        "--out",
        outputDir,
        "--base",
        basePath,
      ],
      workDir,
    );

    const { manifest, manifestFilePath } = await writePreviewManifest({
      previewId,
      buildId,
      basePath,
      outputDir,
      sourceEntry,
    });

    return {
      buildId,
      previewId,
      basePath,
      sourceEntry,
      previewPath: basePath,
      outputDir,
      manifest,
      manifestFilePath,
    };
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}
