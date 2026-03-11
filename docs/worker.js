export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const pathname = decodeURIComponent(url.pathname);

    if (!pathname.startsWith("/p/")) {
      return new Response("Not Found", { status: 404 });
    }

    const rest = pathname.slice("/p/".length);
    const parts = rest.split("/").filter(Boolean);

    if (parts.length === 0) {
      return new Response("Missing site id", { status: 400 });
    }

    const siteId = parts[0];

    // /p/11 -> /p/11/
    if (pathname === `/p/${siteId}`) {
      return Response.redirect(`${url.origin}/p/${siteId}/`, 301);
    }

    const subPath = parts.slice(1).join("/");
    const basePrefix = `previews/${siteId}`;

    const manifestObj = await env.ASSETS.get(`${basePrefix}/manifest.json`);
    if (!manifestObj) {
      return new Response("Manifest not found", { status: 404 });
    }

    let manifest;
    try {
      manifest = await manifestObj.json();
    } catch {
      return new Response("Invalid manifest.json", { status: 500 });
    }

    if (String(manifest.id) !== String(siteId)) {
      return new Response("Manifest id mismatch", { status: 500 });
    }

    const entry = manifest.entry || "index.html";
    const spaFallback = manifest.spaFallback === true;
    const assetPrefixes = Array.isArray(manifest.assetPrefixes)
      ? manifest.assetPrefixes
      : [];

    const privateFiles = Array.isArray(manifest.privateFiles)
      ? manifest.privateFiles
      : [];

    const objectPath = subPath || entry;

    if (privateFiles.includes(objectPath)) {
      return new Response("Forbidden", { status: 403 });
    }

    const objectKey = `${basePrefix}/${objectPath}`;
    let object = await env.ASSETS.get(objectKey);

    if (object) {
      return buildResponse(object);
    }

    const isAssetPath = assetPrefixes.some(prefix => objectPath.startsWith(prefix));

    // assets/... 找不到，直接 404
    if (isAssetPath) {
      return new Response("Asset Not Found", { status: 404 });
    }

    // 非资源路径才允许 SPA fallback
    if (spaFallback) {
      const fallbackObj = await env.ASSETS.get(`${basePrefix}/${entry}`);
      if (!fallbackObj) {
        return new Response("Entry file not found", { status: 404 });
      }

      const response = buildResponse(fallbackObj);
      response.headers.set("content-type", "text/html; charset=UTF-8");
      return response;
    }

    return new Response("Not Found", { status: 404 });
  },
};

function buildResponse(object) {
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  if (object.httpEtag) {
    headers.set("etag", object.httpEtag);
  }
  return new Response(object.body, {
    status: 200,
    headers,
  });
}