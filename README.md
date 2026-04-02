# MarkOS Renderer

轻量的 Markdown 幻灯片渲染服务。

当前定位：
- 保留现有 HTTP / gRPC 服务边界
- 输出静态 SPA 幻灯片站点
- 使用自建 `markos-web` 引擎
- 当前仅支持 `web` 产物

## Endpoints

- `GET /healthz`
- `POST /api/preview/session`
- `POST /api/render`
- `POST /api/previews/build`
- `GET /preview/:sessionId/*`
- `GET /p/:previewId/*`
- `GET /artifacts/*`

## Local Development

```bash
npm install
npm run dev
```

启动成功后，控制台会看到：

```text
[markos-renderer] gRPC server listening on :50051
[markos-renderer] listening on :3210
```

本地地址：
- HTTP: `http://127.0.0.1:3210`
- gRPC: `127.0.0.1:50051`

如果本机代理会干扰 `localhost`，优先使用 `127.0.0.1`。

## Supported Output

当前只支持：
- `web`

`pdf` / `pptx` 现在会被明确拒绝，不再有 Slidev 回退。

## Request Shape

最小渲染请求：

```json
{
  "title": "demo",
  "content": "---\nlayout: cover\n---\n\n# Hello MarkOS\n",
  "format": "web"
}
```

多文件预览构建示例：

```json
{
  "previewId": "demo-preview",
  "basePath": "/p/demo-preview/",
  "entry": "slides.md",
  "source": {
    "files": [
      {
        "path": "slides.md",
        "content": "---\nlayout: cover\n---\n\n# Hello\n"
      },
      {
        "path": "styles/index.css",
        "content": ".accent { color: #f06b1f; }"
      }
    ]
  }
}
```

## Engine Notes

当前 `markos-web` 已支持：
- 顶部 headmatter
- `---` 分页
- 每页 frontmatter
- `layout: cover`
- `layout: two-cols`
- `::right::`
- 视口比例与画布宽度
- presenter / overview / export 视图
- 本地 CSS 打包和静态资源复制

## Storage

本地产物目录：
- `.markos-artifacts/previews`
- `.markos-artifacts/preview-cache`
- `.markos-artifacts/renders`
- `.markos-artifacts/render-cache`
- `.markos-preview`
- `.markos-preview-work`

## Compatibility

为了后端兼容，仓库里仍保留：
- `src/slidev_service.proto`
- 现有 HTTP / gRPC 接口路径

这些兼容层并不代表内部仍在使用 Slidev。
