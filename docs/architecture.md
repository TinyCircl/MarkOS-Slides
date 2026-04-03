# MarkOS Architecture

当前这个开源仓库聚焦两条主线：
- `core`
  通用构建能力
- `cli`
  本地作者工作流

## 目录

- `packages/core/src`
  核心构建流程、输入规范化、manifest site、共享配置
- `packages/core/assets`
  内置静态资源
- `packages/core/styles/presets`
  内置默认样式预设
- `packages/cli/src`
  `markos build` / `markos dev`
- `src/`
  开源侧兼容入口

## 核心流程

`markos build` / `markos dev` 的核心路径是：

1. CLI 解析参数
2. 把本地项目读取成统一 source files
3. `core` 负责规范化输入和写入工作目录
4. `markos-web` 引擎生成静态站点
5. `dev` 模式再通过 manifest site server 提供本地访问

## 当前边界

这个仓库保留：
- Markdown/source files 到静态 slides site 的转换
- 本地作者体验
- 内置资源和默认样式

这个仓库不再保留：
- HTTP / gRPC 服务适配层
- preview session / publish / R2
- Docker / GCP / 部署流水线

这些内容已经迁往内部仓库。
