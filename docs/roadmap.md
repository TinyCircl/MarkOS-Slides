# MarkOS Roadmap

这份文档把“同时保留托管服务能力 + 开源个人可用项目”这条路线，整理成一份更具体的拆分地图。

## 当前结论

这条路线已经从“概念可行”进入“结构已成型”阶段。

当前已经完成的主线：
- 核心构建能力已从服务层抽离
- CLI 已有 `build` / `dev`
- `server-only` 适配层已集中到 `src/server/`
- 包入口已按 `core / cli / server` 收敛
- workspace 包骨架已固定未来 `core / cli / server` 的发布边界
- 配置模型已集中到 `src/config/`
- `export` 已被明确标记为暂不支持
- 面向外部用户的 README、CLI、API、release 文档已补齐
- examples、贡献说明、CI 已补齐

所以接下来已经不是“要不要重构”，而是“以什么节奏公开发布”。

## 目标形态

MarkOS 最终要同时支持两种产品入口：

### 1. 本地作者工具

主要面向：
- 个人用户
- 文档作者
- 本地 slide 项目

入口：
- `markos build`
- `markos dev`

对应代码：
- `src/core`
- `src/cli`

### 2. 托管服务能力

主要面向：
- 内部系统接入
- 兼容已有 HTTP / gRPC 协议
- preview / publish / R2 这类服务化需求

对应代码：
- `src/server`
- `src/preview-manager.mjs`
- `src/r2-client.mjs`

## 拆分路线图

### Step 1. 明确 `server-only` 边界

状态：
- 已完成

关键文件：
- `src/server/http-app.mjs`
- `src/server/grpc-service.mjs`
- `src/server/index.mjs`
- `src/server.mjs`
- `src/grpc-server.mjs`

结果：
- HTTP / gRPC 实现已进入显式的 server 目录
- 顶层入口只承担兼容包装职责

### Step 2. 补真正的包入口设计

状态：
- 已完成

关键文件：
- `package.json`
- `src/index.mjs`
- `src/cli/index.mjs`
- `src/server/index.mjs`

结果：
- 已经形成：
  - `package root`
  - `package subpath ./cli`
  - `package subpath ./server`

### Step 3. 统一配置模型

状态：
- 已完成

关键文件：
- `src/config/index.mjs`
- `src/core/path-utils.mjs`
- `src/preview-manager.mjs`
- `src/core/artifact-store.mjs`
- `src/server/http-app.mjs`
- `src/server/grpc-service.mjs`

结果：
- CLI / core / server 的默认值和配置解析已经集中
- `authoring` / `hosted` 的语义不再散落在各层

### Step 4. 补 `export` 或明确不做

状态：
- 已完成当前阶段决策

关键文件：
- `src/cli/index.mjs`
- `docs/cli.md`
- `docs/release.md`
- `test/cli.test.mjs`

结果：
- 当前阶段明确只做 `build` / `dev`
- `markos export` 保留为未来边界，但不会假装已经支持

### Step 5. 整理仓库形态

状态：
- 已完成当前阶段落地

当前选择：
- 保持单仓库
- 使用显式分层：
  - `src/core`
  - `src/cli`
  - `src/server`
  - `src/config`
- 同时补上：
  - `packages/core`
  - `packages/cli`
  - `packages/server`

为什么先不切 monorepo：
- 现在代码体量还不大
- 包边界已经清楚
- 先做开源可用性，比先做仓库搬家更值

当前这一步的实际结果是：
- 源码仍留在 `src/`
- 未来独立发布的包边界已经通过 workspace 包装层固定下来
- 以后如果要真的切到多包发布，不需要再从零定义边界

什么时候再考虑 monorepo：
- 要独立发布多个 npm 包
- CLI 和 server 发布节奏分离
- 团队需要更清楚的包 ownership

### Step 6. 开源化收尾

状态：
- 已完成绝大部分

关键文件：
- `README.md`
- `docs/cli.md`
- `docs/api.md`
- `docs/release.md`
- `examples/`
- `CONTRIBUTING.md`
- `.github/workflows/ci.yml`

当前剩余：
- LICENSE 选择
- 对外包名 / 品牌
- 是否发 npm CLI

## 文件地图

### Core

推荐从这些文件开始看：
- `src/index.mjs`
- `src/core/index.mjs`
- `src/core/source-pipeline.mjs`
- `src/core/local-project.mjs`
- `src/core/manifest-site.mjs`
- `src/core/dev-server.mjs`

### CLI

推荐从这些文件开始看：
- `src/cli/index.mjs`
- `src/cli.mjs`
- `docs/cli.md`
- `examples/basic/`
- `examples/project/`

### Server

推荐从这些文件开始看：
- `src/server/index.mjs`
- `src/server/http-app.mjs`
- `src/server/grpc-service.mjs`
- `docs/api.md`

### Shared Config

关键文件：
- `src/config/index.mjs`

它现在是：
- 默认入口文件
- 默认端口
- 默认输出目录
- 模式默认值
- 清理周期

的统一来源。

## 还剩下什么

现在真正阻塞“正式公开发布”的，主要只剩仓库所有者决策：

1. 选 LICENSE
2. 确认包名 / 品牌
3. 确认是否发 npm CLI

如果这三项定了，MarkOS 就已经接近一套完整的公开项目，而不只是一个内部渲染服务仓库。
