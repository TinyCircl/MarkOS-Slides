# Open Source Release Notes

这份文档记录当前开源仓库的发布边界。

## 当前仓库形态

当前仓库只保留开源侧能力：
- `packages/core`
- `packages/cli`

实际实现位置：
- `packages/core/src`
- `packages/core/assets`
- `packages/core/styles/presets`
- `packages/cli/src`

根目录 `src/*` 只保留开源侧兼容入口。

## 已迁出内容

这些内容已经迁到内部仓库：
- 服务端适配层
- preview / publish / R2
- Dockerfile
- `docs/deploy/`
- `.github/workflows/deploy.yml`
- 服务端联调脚本与服务端测试

## 发布前还需要确认

1. 许可证
2. 包名与品牌
3. 是否发布 npm CLI

## 开源仓库检查清单

- README 是否面向外部用户
- `docs/cli.md` 是否与当前 CLI 一致
- `examples/` 是否可直接跑通
- `npm run check` 是否通过
- LICENSE 是否已经明确
