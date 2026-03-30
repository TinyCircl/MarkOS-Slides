# Slidev Renderer

Standalone Node service that wraps `@slidev/cli` for Pebble.

## Endpoints

- `GET /healthz`
- `POST /api/preview/session`
- `POST /api/render`
- `POST /api/previews/build`
- `GET /preview/:sessionId/*`
- `GET /p/:previewId/*`
- `GET /artifacts/*`

## Local development

```bash
npm install
npm run dev
```

建议直接在 WebStorm 里运行 `dev`。

服务启动成功后，控制台会看到：

```text
[slidev-renderer] gRPC server listening on :50051
[slidev-renderer] listening on :3210
```

本地地址：

- HTTP: `http://localhost:3210`
- gRPC: `localhost:50051`

## Apifox 调试

本地 `dev` 跑起来之后，可以直接用 Apifox 请求 HTTP 接口来编译 Slidev。

### 1. 导出渲染产物

请求：

- Method: `POST`
- URL: `http://localhost:3210/api/render`
- Header: `Content-Type: application/json`

请求体最小示例：

```json
{
  "title": "demo",
  "content": "---\nlayout: cover\n---\n\n# Hello Slidev\n\n---\n\n# Page 2\n",
  "format": "web"
}
```

可选字段：

- `format`: `web` / `pdf` / `pptx`
- `fileName`: 导出文件名，可选
- `publish`: 是否同时上传到 R2，可选，默认 `false`
- `assets`: 额外资源文件，可选，格式为 `[{ "path": "images/a.png", "contentBase64": "..." }]`

返回里重点看：

- `artifactUrl`: 产物地址
- `siteUrl`: 当 `format` 为 `web` 时可直接打开
- `cacheHit`: 是否命中本地导出缓存
- `publishedArtifactUrl`: 当 `publish=true` 且上传成功时返回

### 2. 构建预览站点

如果要构建 `/p/:previewId/` 这种预览站点，请求：

- Method: `POST`
- URL: `http://localhost:3210/api/previews/build`
- Header: `Content-Type: application/json`

请求体示例：

```json
{
  "previewId": "demo-preview",
  "basePath": "/p/demo-preview/",
  "entry": "slides.md",
  "title": "demo-preview",
  "content": "---\nlayout: cover\n---\n\n# Hello Slidev\n"
}
```

返回里重点看：

- `previewUrl`
- `localPreviewUrl`
- `publishedPreviewUrl`

## Markdown 转 JSON 脚本

仓库内新增了一个脚本：`scripts/md_to_request_json.py`

它会把 `.md` 文件读出来，并转成可以直接粘到 Apifox Body 里的 JSON。

脚本默认会转义非 ASCII 字符，避免 Windows 控制台因为 GBK 编码报错；如果明确需要直接输出 UTF-8 字符，可以追加 `--no-ascii-escape`。

### 生成 `/api/render` 请求体

```bash
python scripts/slidev_to_json.py test/fixtures/markdown/base.md > render.json
```

如果要导出 PDF：

```bash
python scripts/slidev_to_json.py test/fixtures/markdown/base.md --format pdf --file-name base > render-pdf.json
```

### 生成 `/api/previews/build` 请求体

```bash
python scripts/slidev_to_json.py test/fixtures/markdown/base.md --api preview-build --preview-id demo-preview > preview-build.json
```

### 生成 `/api/preview/session` 请求体

```bash
python scripts/slidev_to_json.py test/fixtures/markdown/base.md --api preview-session --project-id demo-project > preview-session.json
```

### 使用方式

1. 运行上面的命令生成 JSON 文件。
2. 打开生成的 `*.json`。
3. 把文件内容整体复制到 Apifox 的 `Body -> raw -> JSON`。
4. 发送请求。

如果你在 PowerShell 里想直接查看生成结果，也可以：

```powershell
python scripts/md_to_request_json.py test/fixtures/markdown/base.md | Out-String
```

## Notes

- `pdf` / `pptx` export relies on Playwright. Install optional dependencies locally if needed.
- In Docker / Cloud Run, prefer baking Playwright + Chromium into the image.
- `SLIDEV_EXPORT_TIMEOUT_MS` controls the Slidev CLI export page-render timeout for `pdf` / `pptx`. The current default is `30000`.
- Local compiled artifacts are now retained for up to 7 days by default and cleaned by a periodic background sweep.
- Preview/site caches live under `.slidev-artifacts/previews` + `.slidev-artifacts/preview-cache`; one-off exports live under `.slidev-artifacts/renders` + `.slidev-artifacts/render-cache`.

## Hosted Renderer 需求

对于 Pebble 的托管 Slidev 渲染器，当前需求是：

- 所有“路径引用”都必须在渲染前从 markdown 中去掉。
- 这条规则**不依赖** renderer 当前是否刚好能解析这个路径。
- 只要是路径引用，就视为应移除的输入。
- 互联网 URL **不属于**这里说的“路径引用”。

换句话说，当前判定边界是：

- 移除：
  - `./avatar.png`
  - `../images/a.png`
  - `/assets/banner.png`
  - 其他相对路径、项目内绝对路径、根路径引用
- 保留：
  - `https://example.com/a.png`
  - `https://example.com`
  - 其他 Web URL

### 需求作用范围

这条需求适用于托管 Slidev 源里的路径引用，包括但不限于：

- markdown 里的图片 / 文件路径引用
- HTML 中的 `src` / `data` / 类似资源属性里的路径引用
- 会引入路径依赖或额外运行时依赖的自定义组件 / 组件式引用

普通 HTML 结构本身**不是**这条规则的处理目标。比如：

- `<div>`
- `<span>`
- `<p>`
- 普通 `<a>` 链接

不应仅仅因为它们是 HTML 就被删除。

### 重要澄清

这里的需求**不是**：

- “只有当 renderer 无法解析时才移除引用”

这里的需求**是**：

- “不管某个环境里这条路径是否刚好能工作，只要是路径引用，就移除”

## Fixture 用途

`test/fixtures/markdown` 目录会保留在仓库里，作为后续服务侧压力测试和更广覆盖回归测试的样例池。

当前约定：

- 日常 smoke / 基础回归优先使用 `base.md`
- 大多数情况下，`base.md` 足够覆盖常规验证
- 只有需要更大语料或压力场景时，才使用更大的 `.txt` 样例
- 更广覆盖的 corpus sweep 应加载 `test/fixtures/markdown` 下所有 `.md` / `.txt` 文件
- 不要把这个目录当成误提交或无用数据直接删除

保留这段说明的原因：

- 确保默认测试路径持续围绕 `base.md`
- 避免后续清理时把这批样例误判成死文件

## Fixture 检查器

项目内提供了一个简单的 fixture 检查器，用来批量验证
`test/fixtures/markdown` 下的样例在当前服务侧规则下是否仍然残留“路径引用”。

运行方式：

```bash
npm run check:fixtures
```

或：

```bash
pnpm run check:fixtures
```

当前检查器会输出 JSON 摘要，重点包括：

- 总 fixture 数量
- 路径引用规则通过 / 失败数量
- 哪些文件仍残留路径型图片、HTML 资源引用、`<<<` 路径导入
- 额外的组件式标签观察项

注意：

- 当前退出码只对“路径引用规则失败”生效
- `componentFindings` 目前是观察信息，不会让脚本失败
