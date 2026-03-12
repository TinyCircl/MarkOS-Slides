import {
  DeleteObjectsCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { readdir, readFile } from "node:fs/promises";
import { extname, join } from "node:path";

const MAX_R2_UPLOAD_CONCURRENCY = 6;
const MAX_R2_DELETE_BATCH_SIZE = 1000;
const R2_LIST_PAGE_SIZE = 1000;

const MIME_TYPES = new Map([
  [".css", "text/css; charset=utf-8"],
  [".gif", "image/gif"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".map", "application/json; charset=utf-8"],
  [".md", "text/markdown; charset=utf-8"],
  [".pdf", "application/pdf"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".txt", "text/plain; charset=utf-8"],
  [".webp", "image/webp"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
  [".xml", "application/xml; charset=utf-8"],
]);

let client = null;

function normalizeDomain(domain) {
  const trimmed = domain?.trim();
  return trimmed ? trimmed.replace(/\/+$/g, "") : null;
}

function sanitizeObjectSegment(segment) {
  const normalizedSegment = String(segment)
    .replace(/\\/g, "/")
    .replace(/^\/+|\/+$/g, "")
    .replace(/^(\.\.\/)+/, "");

  if (!normalizedSegment || normalizedSegment === "." || normalizedSegment.startsWith("..")) {
    throw new Error(`Invalid R2 object key segment: ${segment}`);
  }

  return normalizedSegment;
}

export function joinR2Key(...segments) {
  const parts = [];

  for (const segment of segments) {
    if (segment == null) continue;
    const trimmed = String(segment).trim();
    if (!trimmed) continue;
    parts.push(sanitizeObjectSegment(trimmed));
  }

  return parts.join("/");
}

export function getR2Config() {
  const accountId = process.env.R2_PUBLIC_ACCOUNT_ID?.trim() || "";
  const accessKeyId = process.env.R2_PUBLIC_ACCESS_KEY?.trim() || "";
  const secretAccessKey = process.env.R2_PUBLIC_SECRET_KEY?.trim() || "";
  const bucket = process.env.R2_PUBLIC_BUCKET?.trim() || "";
  const publicDomain = normalizeDomain(process.env.R2_PUBLIC_DOMAIN);
  const privatePathPrefix = process.env.R2_PRIVATE_PATH_PREFIX?.trim()
    ? joinR2Key(process.env.R2_PRIVATE_PATH_PREFIX)
    : "";

  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucket,
    publicDomain,
    privatePathPrefix,
    endpoint: accountId ? `https://${accountId}.r2.cloudflarestorage.com` : null,
  };
}

export function isR2Configured() {
  const config = getR2Config();
  return Boolean(config.accountId && config.accessKeyId && config.secretAccessKey && config.bucket);
}

export function assertR2Configured() {
  const config = getR2Config();
  const missing = [];

  if (!config.accountId) missing.push("R2_PUBLIC_ACCOUNT_ID");
  if (!config.accessKeyId) missing.push("R2_PUBLIC_ACCESS_KEY");
  if (!config.secretAccessKey) missing.push("R2_PUBLIC_SECRET_KEY");
  if (!config.bucket) missing.push("R2_PUBLIC_BUCKET");

  if (missing.length > 0) {
    throw new Error(`Missing R2 environment variables: ${missing.join(", ")}`);
  }

  return config;
}

export function getR2Client() {
  const config = assertR2Configured();

  if (!client) {
    client = new S3Client({
      region: "auto",
      endpoint: config.endpoint,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }

  return client;
}

export function getR2PublicUrl(objectKey) {
  const { publicDomain } = getR2Config();
  if (!publicDomain) {
    return null;
  }
  return `${publicDomain}/${joinR2Key(objectKey)}`;
}

function getR2ObjectPrefix(keyPrefix) {
  const normalizedPrefix = joinR2Key(keyPrefix);
  return normalizedPrefix ? `${normalizedPrefix}/` : "";
}

function getContentType(filePath) {
  return MIME_TYPES.get(extname(filePath).toLowerCase()) || "application/octet-stream";
}

function getCacheControl(filePath) {
  const normalizedPath = filePath.replace(/\\/g, "/").toLowerCase();

  if (normalizedPath.endsWith("manifest.json") || normalizedPath.endsWith("index.html") || normalizedPath.endsWith("404.html")) {
    return "no-cache";
  }

  if (normalizedPath.startsWith("assets/")) {
    return "public, max-age=31536000, immutable";
  }

  return "public, max-age=3600";
}

async function listLocalFiles(rootDir, currentDir = rootDir) {
  const entries = await readdir(currentDir, { withFileTypes: true });
  const results = [];

  for (const entry of entries) {
    const absolutePath = join(currentDir, entry.name);
    if (entry.isDirectory()) {
      results.push(...await listLocalFiles(rootDir, absolutePath));
      continue;
    }
    if (!entry.isFile()) {
      continue;
    }
    results.push(absolutePath.slice(rootDir.length + 1).replace(/\\/g, "/"));
  }

  return results.sort((left, right) => left.localeCompare(right));
}

async function mapWithConcurrency(items, concurrency, mapper) {
  if (items.length === 0) {
    return [];
  }

  const results = new Array(items.length);
  let nextIndex = 0;
  const workerCount = Math.min(Math.max(1, concurrency), items.length);

  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (true) {
      const currentIndex = nextIndex;
      nextIndex += 1;

      if (currentIndex >= items.length) {
        return;
      }

      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  }));

  return results;
}

function chunkItems(items, chunkSize) {
  const results = [];

  for (let index = 0; index < items.length; index += chunkSize) {
    results.push(items.slice(index, index + chunkSize));
  }

  return results;
}

function shouldReuseRemoteObject(relativePath, objectKey, remoteKeySet) {
  const normalizedPath = relativePath.replace(/\\/g, "/");
  return normalizedPath.startsWith("assets/") && remoteKeySet.has(objectKey);
}

export async function putR2Object({ key, body, contentType, cacheControl }) {
  const config = assertR2Configured();
  const objectKey = joinR2Key(key);

  await getR2Client().send(new PutObjectCommand({
    Bucket: config.bucket,
    Key: objectKey,
    Body: body,
    ContentType: contentType,
    CacheControl: cacheControl,
  }));

  return {
    bucket: config.bucket,
    key: objectKey,
    url: getR2PublicUrl(objectKey),
  };
}

export async function listR2Objects({ keyPrefix }) {
  const config = assertR2Configured();
  const objectPrefix = getR2ObjectPrefix(keyPrefix);
  const objects = [];
  let continuationToken;

  while (true) {
    const result = await getR2Client().send(new ListObjectsV2Command({
      Bucket: config.bucket,
      Prefix: objectPrefix,
      ContinuationToken: continuationToken,
      MaxKeys: R2_LIST_PAGE_SIZE,
    }));

    for (const object of result.Contents ?? []) {
      if (!object.Key) {
        continue;
      }

      objects.push({
        key: object.Key,
        etag: object.ETag ?? null,
        size: typeof object.Size === "number" ? object.Size : null,
      });
    }

    if (!result.IsTruncated || !result.NextContinuationToken) {
      break;
    }

    continuationToken = result.NextContinuationToken;
  }

  return {
    bucket: config.bucket,
    objectPrefix,
    objects,
  };
}

export async function deleteR2Objects({ keys }) {
  const config = assertR2Configured();
  const objectKeys = Array.from(new Set(
    keys
      .filter((key) => key != null && String(key).trim().length > 0)
      .map((key) => joinR2Key(key)),
  ));

  if (objectKeys.length === 0) {
    return {
      bucket: config.bucket,
      deletedFileCount: 0,
      deletedKeys: [],
    };
  }

  for (const keyChunk of chunkItems(objectKeys, MAX_R2_DELETE_BATCH_SIZE)) {
    await getR2Client().send(new DeleteObjectsCommand({
      Bucket: config.bucket,
      Delete: {
        Objects: keyChunk.map((key) => ({ Key: key })),
        Quiet: true,
      },
    }));
  }

  return {
    bucket: config.bucket,
    deletedFileCount: objectKeys.length,
    deletedKeys: objectKeys,
  };
}

export async function uploadDirectoryToR2({ localDir, keyPrefix }) {
  const relativeFiles = await listLocalFiles(localDir);
  const objectPrefix = getR2ObjectPrefix(keyPrefix);
  const remoteObjects = await listR2Objects({ keyPrefix });
  const remoteKeySet = new Set(remoteObjects.objects.map((object) => object.key));
  const currentObjectKeys = relativeFiles.map((relativePath) => joinR2Key(keyPrefix, relativePath));
  const currentObjectKeySet = new Set(currentObjectKeys);
  const skippedKeys = [];
  const filesToUpload = [];

  for (const relativePath of relativeFiles) {
    const objectKey = joinR2Key(keyPrefix, relativePath);
    if (shouldReuseRemoteObject(relativePath, objectKey, remoteKeySet)) {
      skippedKeys.push(objectKey);
      continue;
    }

    filesToUpload.push({
      relativePath,
      objectKey,
    });
  }

  const uploadedKeys = await mapWithConcurrency(filesToUpload, MAX_R2_UPLOAD_CONCURRENCY, async ({ relativePath, objectKey }) => {
    const absolutePath = join(localDir, relativePath);
    const body = await readFile(absolutePath);

    await putR2Object({
      key: objectKey,
      body,
      contentType: getContentType(relativePath),
      cacheControl: getCacheControl(relativePath),
    });

    return objectKey;
  });

  const deletedKeys = remoteObjects.objects
    .map((object) => object.key)
    .filter((key) => !currentObjectKeySet.has(key));

  if (deletedKeys.length > 0) {
    await deleteR2Objects({ keys: deletedKeys });
  }

  return {
    uploadedFileCount: uploadedKeys.length,
    uploadedKeys,
    skippedUploadFileCount: skippedKeys.length,
    skippedUploadKeys: skippedKeys,
    deletedFileCount: deletedKeys.length,
    deletedKeys,
    remoteFileCountBefore: remoteObjects.objects.length,
    objectPrefix: joinR2Key(keyPrefix),
    listedObjectPrefix: objectPrefix,
    publicBaseUrl: getR2PublicUrl(joinR2Key(keyPrefix, "")) || null,
  };
}

export async function publishPreviewSiteToR2({ previewId, outputDir }) {
  const config = assertR2Configured();
  const objectPrefix = joinR2Key(config.privatePathPrefix, previewId);
  const result = await uploadDirectoryToR2({
    localDir: outputDir,
    keyPrefix: objectPrefix,
  });

  return {
    bucket: config.bucket,
    objectPrefix,
    manifestKey: joinR2Key(objectPrefix, "manifest.json"),
    manifestUrl: getR2PublicUrl(joinR2Key(objectPrefix, "manifest.json")),
    publicBaseUrl: config.publicDomain ? `${config.publicDomain}/${objectPrefix}/` : null,
    uploadedFileCount: result.uploadedFileCount,
    uploadedKeys: result.uploadedKeys,
    skippedUploadFileCount: result.skippedUploadFileCount,
    skippedUploadKeys: result.skippedUploadKeys,
    deletedFileCount: result.deletedFileCount,
    deletedKeys: result.deletedKeys,
    remoteFileCountBefore: result.remoteFileCountBefore,
  };
}
