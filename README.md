# Slidev Renderer

Standalone Node service that wraps `@slidev/cli` for Pebble.

## Endpoints

- `GET /healthz`
- `POST /api/preview/session`
- `POST /api/render`
- `GET /preview/:sessionId/*`
- `GET /artifacts/*`

## Local development

```bash
npm install
npm run dev
```

Default local URL: `http://localhost:3210`

## Notes

- `pdf` / `pptx` export relies on Playwright. Install optional dependencies locally if needed.
- In Docker / Cloud Run, prefer baking Playwright + Chromium into the image.

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
