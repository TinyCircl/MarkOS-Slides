# Contributing

感谢你愿意参与 MarkOS。

当前这个仓库聚焦开源侧的两类能力：
- 通用构建内核
- 本地作者 CLI

## 本地开发

运行环境：
- Node.js `>=22`

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

## 代码组织

当前推荐把改动落在明确分层里：
- `packages/core/src`
  纯构建、输入规范化、引擎、manifest site、共享配置
- `packages/core/assets`
  `core` 自带的内置资源
- `packages/core/styles/presets`
  `core` 自带的默认样式预设
- `packages/cli/src`
  本地作者工作流

根目录保留少量兼容入口：
- `src/index.mjs`
- `src/cli.mjs`
- `src/cli/index.mjs`

当前对外公开的 workspace 包是：
- `packages/core`
- `packages/cli`

公司内部的服务端仓库已经拆出；这个开源仓库不再维护服务端、部署和内部 bootstrap 文档。

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

当前不在这个开源仓库里的内容：
- HTTP / gRPC 服务适配层
- preview / publish / R2 这类托管服务能力
- Docker / GCP / 部署 CI/CD

如果你想推动：
- `pdf` / `pptx`
- 真正的 `export`
- 主题/插件系统
- 更复杂的仓库拆分策略

建议先在 issue 或设计文档里明确影响范围，再进入实现。
