# MarkOS API

MarkOS 当前保留一套兼容型 HTTP / gRPC 服务边界，方便已有系统继续调用。

当前代码入口有两层：
- 实现入口：`src/server/index.mjs`
- workspace 包装层：`packages/server`

## 基本约定

- 当前只支持 `web`
- `pdf` / `pptx` 会被明确拒绝
- 输入可以是：
  - 单文件 `content`
  - 多文件 `source.files`

HTTP 默认端口：
- `3210`

gRPC 默认端口：
- `50051`

proto 文件：
- `src/slidev_service.proto`

## HTTP

### `GET /healthz`

健康检查。

响应：

```json
{
  "ok": true
}
```

### `POST /api/preview/session`

创建短生命周期预览会话。

最小请求：

```json
{
  "title": "Demo",
  "content": "---\nlayout: cover\n---\n\n# Hello\n"
}
```

典型响应字段：
- `sessionId`
- `slidesUrl`
- `overviewUrl`
- `presenterUrl`

### `POST /api/previews/build`

构建一个命名 preview 站点，返回稳定的 `/p/{previewId}/` 地址。

示例：

```json
{
  "previewId": "demo-preview",
  "basePath": "/p/demo-preview/",
  "entry": "slides.md",
  "source": {
    "files": [
      {
        "path": "slides.md",
        "content": "---\nlayout: cover\n---\n\n# Hello MarkOS\n"
      },
      {
        "path": "styles/index.css",
        "content": ".accent { color: #f06b1f; }"
      }
    ]
  }
}
```

典型响应字段：
- `previewId`
- `buildId`
- `previewUrl`
- `publishedPreviewUrl`
- `manifest`
- `cacheHit`
- `timings`

### `POST /api/render`

构建通用渲染产物。

示例：

```json
{
  "title": "demo",
  "content": "---\nlayout: cover\n---\n\n# Hello MarkOS\n",
  "format": "web"
}
```

典型响应字段：
- `jobId`
- `artifactUrl`
- `siteUrl`
- `publishedArtifactUrl`
- `cacheHit`
- `timings`

### 静态分发路由

- `GET /preview/:sessionId/*`
  临时 preview session 输出
- `GET /p/:previewId/*`
  命名 preview 站点输出
- `GET /artifacts/*`
  render 产物输出

## gRPC

当前暴露两个方法：
- `BuildPreview`
- `RenderArtifact`

gRPC 适配层会继续保持和 HTTP 层一致的校验语义，包括：
- `previewId` 命名规则
- `basePath` 必须匹配 `/p/{previewId}/`
- 非 `web` 格式会被拒绝
- `binaryContent` 会被转换成内部 base64 source file 形态

## 推荐输入方式

如果你是新接入方，优先推荐：
- 本地作者工具：直接用 CLI
- 服务端集成：尽量使用 `source.files`

原因是多文件输入比单个 `content` 更完整，更接近真实 slide 项目目录，也更能保留本地 CSS 和资源引用。

## 当前非目标

这套 API 目前不覆盖：
- `pdf` / `pptx` 导出
- 主题市场
- 用户账户体系
- 多实例共享 preview session

如果需要看更细的内部执行过程，继续看 `docs/architecture.md`。
