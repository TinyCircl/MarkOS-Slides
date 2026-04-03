# MarkOS

MarkOS 是一个 Markdown -> Slides 的开源工具链仓库。

当前这个仓库只保留开源侧能力：
- 通用构建内核
- 本地作者 CLI

服务端接入、预览发布、对象存储和部署链路已经迁往内部仓库，不再作为这个开源仓库的默认职责。

## 当前能力

支持：
- `markos build`
- `markos dev`
- 多文件 source tree
- 本地 CSS 打包和静态资源复制
- presenter / overview / export 视图运行时

当前不支持：
- `pdf`
- `pptx`
- `markos export`

## 快速开始

运行环境要求：
- Node.js `>=22`

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

完整检查：

```bash
npm run check
```

## 仓库结构

当前仓库采用“workspace 实现包 + 根级兼容入口”的结构：

- `packages/core/src`
  开源侧的通用构建内核、引擎、manifest site、共享配置
- `packages/core/assets` / `packages/core/styles/presets`
  `core` 自带的内置资源与默认样式
- `packages/cli/src`
  开源侧的本地作者 CLI
- `src/`
  开源侧兼容入口，主要保留 `src/index.mjs`、`src/cli/index.mjs`、`src/cli.mjs`

## 双仓库说明

如果要拆成“开源仓库 + 公司内部仓库”，推荐这样划分：

- 开源仓库
  保留 `packages/core`、`packages/cli`、`examples/`、`test/`、公共 CI 和面向外部用户的文档
- 内部仓库
  承接服务端适配层、部署脚本、Docker / GCP / 对象存储相关 CI/CD，以及任何业务接入层

内部服务仓库相关文档已经迁出，不再在这个开源仓库维护。

## 文档

- 文档索引：[docs/README.md](docs/README.md)
- 架构说明：[docs/architecture.md](docs/architecture.md)
- CLI 使用说明：[docs/cli.md](docs/cli.md)
- 拆分路线图：[docs/roadmap.md](docs/roadmap.md)
- 开源发布与收尾清单：[docs/release.md](docs/release.md)
- Commit 规范：[docs/COMMIT_CONVENTION.md](docs/COMMIT_CONVENTION.md)
- 贡献说明：[CONTRIBUTING.md](CONTRIBUTING.md)
- 协作规范：[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)
- 安全说明：[SECURITY.md](SECURITY.md)

## Examples

- [examples/basic](examples/basic)
  最小单文件 deck
- [examples/project](examples/project)
  带 `styles/` 和 `assets/` 的本地作者项目

## 验证

常用验证命令：
- `npm test`
- `npm run check:fixtures`
- `npm run check:examples`
- `npm run check`
