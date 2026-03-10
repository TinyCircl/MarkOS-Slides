import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, normalize } from "node:path";
import { spawn } from "node:child_process";

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
  const normalizedPath = normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, "");
  if (!normalizedPath || normalizedPath.startsWith("..")) {
    throw new Error(`Invalid asset path: ${relativePath}`);
  }
  return normalizedPath;
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

async function writeAssets(rootDir, assets = []) {
  for (const asset of assets) {
    const relativePath = sanitizeRelativePath(asset.path);
    const targetPath = join(rootDir, relativePath);
    await mkdir(dirname(targetPath), { recursive: true });
    await writeFile(targetPath, Buffer.from(asset.contentBase64, "base64"));
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
