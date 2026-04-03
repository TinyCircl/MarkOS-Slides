# Contributing

感谢你愿意参与 MarkOS。

当前这个仓库同时服务两类场景：
- 本地作者工作流
- 托管服务接入

所以在改动时，尽量同时考虑：
- `src/core`
- `src/cli`
- `src/server`

## 本地开发

运行环境：
- Node.js `>=20`

安装依赖：

```bash
npm install
```

常用命令：

```bash
npm test
npm run check:fixtures
npm run check:examples
npm run check
```

本地体验 CLI：

```bash
npm run markos:build -- examples/basic/slides.md --out-dir .markos-example-basic
npm run markos:dev -- examples/project/slides.md --port 3030
```

本地启动服务端：

```bash
npm run dev
```

## 代码组织

当前推荐把改动落在明确分层里：
- `src/core`
  纯构建和输入规范化能力
- `src/cli`
  本地作者工作流
- `src/server`
  HTTP / gRPC / preview / publish 这类托管服务适配层
- `src/config`
  共享默认值和配置解析

另外，仓库已经预留了未来拆包的 workspace 包装层：
- `packages/core`
- `packages/cli`
- `packages/server`

这些目录当前主要承担“对外包边界”和“未来发布形态”的作用，不是主要实现位置。

兼容入口：
- `src/cli.mjs`
- `src/server.mjs`
- `src/grpc-server.mjs`

如果你在改动核心能力，尽量不要把 `server-only` 假设重新带回 `core`。

## 提交前建议

提交前至少跑：

```bash
npm test
npm run check:examples
```

如果你改了 fixture、输入兼容、路径清洗或 markdown 规范化相关逻辑，再加跑：

```bash
npm run check:fixtures
```

## 当前产品边界

为了保持仓库方向稳定，当前请按这些边界来理解改动：
- 支持 `web`
- CLI 支持 `build` / `dev`
- `markos export` 目前明确未开放
- HTTP / gRPC 兼容层仍然保留

如果你想推动：
- `pdf` / `pptx`
- 真正的 `export`
- 主题/插件系统
- monorepo 拆包

建议先在 issue 或设计文档里明确影响范围，再进入实现。
