# MarkOS

MarkOS 是一个 Markdown -> Slides 的工具链。

它现在同时提供两种入口：
- 个人使用：本地 CLI，支持 `markos build` 和 `markos dev`
- 系统接入：保留现有 HTTP / gRPC 渲染服务

当前状态：
- 使用自建 `markos-web` 引擎
- 输出静态 SPA 幻灯片站点
- 当前仅支持 `web`
- `export` 先保留为未来边界，暂未开放

## 快速开始

运行环境要求：
- Node.js `>=20`

安装依赖：

```bash
npm install
```

本地 CLI 构建：

```bash
npm run markos:build -- examples/basic/slides.md --out-dir .markos-example-basic
```

本地 CLI 预览：

```bash
npm run markos:dev -- examples/project/slides.md --port 3030
```

启动服务端：

```bash
npm run dev
```

完整检查：

```bash
npm run check
```

启动成功后，控制台会看到：

```text
[markos-renderer] gRPC server listening on :50051
[markos-renderer] listening on :3210
```

本地服务地址：
- HTTP: `http://127.0.0.1:3210`
- gRPC: `127.0.0.1:50051`

如果本机代理会干扰 `localhost`，优先使用 `127.0.0.1`。

## 当前能力边界

支持：
- `markos build`
- `markos dev`
- HTTP / gRPC 渲染服务
- 多文件 source tree
- 本地 CSS 打包和静态资源复制
- presenter / overview / export 视图运行时

当前不支持：
- `pdf`
- `pptx`
- `markos export`

`pdf` / `pptx` 和 `markos export` 现在都会被明确拒绝，不再有 Slidev 回退。

## 仓库结构

当前仓库采用“单仓库源码 + workspace 包装层”的结构：
- `src/core`
  可复用构建内核
- `src/cli`
  面向个人用户的本地工作流
- `src/server`
  面向托管服务的 HTTP / gRPC 适配层
- `src/config`
  CLI / core / server 共享默认配置
- `packages/core`
  预留给未来 `core` 独立发布的 workspace 包入口
- `packages/cli`
  预留给未来 CLI 独立发布的 workspace 包入口
- `packages/server`
  预留给未来 server 独立发布的 workspace 包入口

同时保留这些兼容入口：
- `src/cli.mjs`
- `src/server.mjs`
- `src/grpc-server.mjs`

## 文档

- 架构说明：[docs/architecture.md](docs/architecture.md)
- 拆分路线图：[docs/roadmap.md](docs/roadmap.md)
- CLI 使用说明：[docs/cli.md](docs/cli.md)
- API 说明：[docs/api.md](docs/api.md)
- 开源发布与收尾清单：[docs/release.md](docs/release.md)
- 贡献说明：[CONTRIBUTING.md](CONTRIBUTING.md)
- 协作规范：[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)
- 安全说明：[SECURITY.md](SECURITY.md)
- 示例项目：[examples/](examples/)

## Examples

- [examples/basic](examples/basic)
  最小单文件 deck
- [examples/project](examples/project)
  带 `styles/` 和 `assets/` 的本地作者项目

## API 概览

HTTP 路由：
- `GET /healthz`
- `POST /api/preview/session`
- `POST /api/render`
- `POST /api/previews/build`
- `GET /preview/:sessionId/*`
- `GET /p/:previewId/*`
- `GET /artifacts/*`

为了后端兼容，仓库里仍保留：
- `src/slidev_service.proto`
- 现有 HTTP / gRPC 接口路径

这些兼容层并不代表内部仍在使用 Slidev。

## 验证

常用验证命令：
- `npm test`
- `npm run check:fixtures`
- `npm run check:examples`
- `npm run check`

如果只是确认 examples 和 README 里的上手路径能跑，优先用 `npm run check:examples`。
