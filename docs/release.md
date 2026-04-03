# Open Source Release Notes

这份文档记录当前仓库朝“可开源维护”形态整理后的状态，以及真正公开发布前还需要确认的事项。

## 当前仓库形态

当前选择的是：
- 继续单仓库
- 在仓库内部显式拆出 `core / cli / server`
- 通过 package subpath exports 暴露三类入口
- 通过 `packages/*` 预留未来独立发布的 workspace 包装层

当前入口：
- `package root -> src/index.mjs`
- `package subpath ./cli -> src/cli/index.mjs`
- `package subpath ./server -> src/server/index.mjs`
- `workspace package packages/core`
- `workspace package packages/cli`
- `workspace package packages/server`

这样做的原因：
- 现在代码体量还不大
- `src/core`、`src/cli`、`src/server` 边界已经足够清晰
- 比直接上 monorepo 更稳，迁移风险更低

如果将来团队要：
- 独立发布多个 npm 包
- 让不同小组分别维护 `core / cli / server`
- 做更严格的依赖隔离

那时再切到 `packages/core`、`packages/cli`、`packages/server` 会更合理。

## 当前已完成

- 核心构建能力已从服务层抽离
- CLI 已具备 `build` / `dev`
- `server-only` 适配层已集中到 `src/server/`
- 共享默认配置已集中到 `src/config/`
- 包入口已拆成 `core / cli / server`
- workspace 包骨架已落到 `packages/core`、`packages/cli`、`packages/server`
- 文档已覆盖架构、CLI、API
- 拆分路线图已整理成 `docs/roadmap.md`
- 贡献说明已整理成 `CONTRIBUTING.md`
- 示例项目已补到 `examples/`
- `export` 目前已经被明确定义为“暂不支持”
- 公共 CI 已补到 `.github/workflows/ci.yml`
- 社区协作文件已补到 issue template、PR template、code of conduct、security policy

## 公开发布前还需要确认

这些事情不适合由代码自动决定，应该由仓库所有者确认：

1. 许可证
   这是最重要的一项。没有明确 LICENSE，就不适合把仓库真正作为开源项目发布。

2. 包名与品牌
   当前根包名仍然是 `@pebble/markos-renderer`，更像内部或过渡命名。
   如果要公开发布，通常需要确认：
   - GitHub 仓库名
   - npm 包名
   - 对外品牌名是 `MarkOS` 还是 `MarkOS Slides`

3. 发布策略
   需要确认是：
   - 只公开 GitHub 仓库
   - 还是同时发布 npm CLI
   - 还是再进一步拆 `core / cli / server` 多包发布

## 建议的公开发布顺序

### 阶段 A：先公开仓库

建议先完成：
- 选定 LICENSE
- 确认 README 和 examples
- 跑完 `npm run check`
- 清理任何不适合公开的内部文案或部署细节

这一步的目标是：
- 仓库可读
- 仓库可运行
- 外部用户能通过 examples 上手

### 阶段 B：再公开 CLI 使用路径

建议在这个阶段确认：
- 对外包名
- 是否保留当前单仓库 package 形式
- 是否开始让外部用户通过 `npx` 或全局安装使用 CLI

这一步的目标是：
- 让个人用户把 MarkOS 当成作者工具来使用

### 阶段 C：最后决定是否拆多包

只有在下面情况更强时，再考虑 monorepo：
- `core` 被第三方代码直接依赖的需求越来越强
- CLI 与 server 的发布节奏明显不同
- 团队需要更清晰的包级 ownership

## 当前 release flow

仓库里已经有一条现成的“镜像构建 + 部署”流程：
- `.github/workflows/deploy.yml`

这次还补了一条面向公开协作的基础验证流程：
- `.github/workflows/ci.yml`

它当前服务于部署型发布，不等于 npm 开源发布。

所以当前应该把两条发布路径区分开：
- 部署发布：继续走 Docker / deploy workflow
- 开源发布：补 LICENSE、确认包名、决定是否发 npm

## 开源前最终检查清单

- README 是否面向外部用户，而不是只面向内部服务接入
- `docs/cli.md`、`docs/api.md` 是否和当前代码一致
- `examples/` 是否可直接跑通
- `npm run check` 是否通过
- LICENSE 是否已经明确
- 包名和发布范围是否已确认

如果这些都完成了，这个仓库就已经接近“适合正式公开维护”的状态了。
