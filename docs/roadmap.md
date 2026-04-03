# MarkOS Roadmap

这份文档记录当前开源仓库的目标形态。

## 当前结论

MarkOS 已经完成从“工具 + 服务混合仓库”到“开源工具仓库”的迁移。

当前这个仓库只负责：
- `core`
- `cli`

内部服务仓库负责：
- `server`
- deploy / CI/CD
- preview / publish / R2

## 当前重点

开源仓库接下来的重点是：
- 稳定 `core` 的公开接口
- 完善 CLI 作者体验
- 补齐开源文档、示例和发布流程

## 当前边界

支持：
- `markos build`
- `markos dev`
- `web`

暂不支持：
- `pdf`
- `pptx`
- `markos export`

## 双仓库建议

如果要继续推进双仓库协作，推荐：

1. 开源仓库发布稳定版本的 `core`
2. 内部仓库按版本升级依赖
3. 内部仓库独立验证和部署
