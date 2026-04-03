# MarkOS CLI

MarkOS CLI 当前面向本地作者工作流，重点是把本地 Markdown 项目构建成静态幻灯片站点。

当前代码入口有两层：
- 实现入口：`packages/cli/src/index.mjs`
- 兼容入口：`src/cli/index.mjs`

## 当前命令

支持：
- `markos build`
- `markos dev`

暂不支持：
- `markos export`

`export` 已经保留成明确边界，但当前会直接返回“不支持”，因为整个项目现在仍是 `web`-only。

## `markos build`

把本地 slide 项目构建成静态输出目录。

用法：

```bash
markos build [entry] [--out-dir dist] [--base /] [--project-root dir] [--title name]
```

常用例子：

```bash
node src/cli.mjs build examples/basic/slides.md
node src/cli.mjs build examples/project/slides.md --out-dir dist
npm run markos:build -- examples/project/slides.md --base /demo/
```

参数：
- `entry`
  入口 Markdown 文件，默认 `slides.md`
- `--out-dir`
  输出目录。默认是入口文件同级的 `dist/`
- `--base`
  站点根路径。默认 `/`
- `--project-root`
  项目根目录。默认使用入口文件所在目录
- `--title`
  当文档没有显式标题时，用于注入默认标题

构建模式：
- CLI 默认走 `authoring` 模式
- 单文件 deck 下不会像托管服务那样主动清洗本地资源引用
- 本地 `styles/`、`assets/` 会被一并装配进构建输入

## `markos dev`

在本地启动静态站点服务，并监听文件变化自动重建。

用法：

```bash
markos dev [entry] [--out-dir .markos-dev] [--base /] [--host 127.0.0.1] [--port 3030]
```

常用例子：

```bash
node src/cli.mjs dev examples/project/slides.md
node src/cli.mjs dev examples/project/slides.md --port 4000
npm run markos:dev -- examples/project/slides.md --base /deck/
```

参数：
- `entry`
  入口 Markdown 文件，默认 `slides.md`
- `--out-dir`
  本地 dev 输出目录。默认是入口文件同级的 `.markos-dev/`
- `--base`
  本地访问路径前缀。默认 `/`
- `--host`
  dev server host，默认 `127.0.0.1`
- `--port`
  dev server port，默认 `3030`；传 `0` 会让系统自动分配端口

本地 dev 行为：
- 先构建一次静态站点
- 再用一个轻量 HTTP server 分发 manifest site
- 监听项目文件变化后自动重建
- 自动忽略输出目录和工作目录的变化

## 验证

如果你在改 CLI 或 examples，常用检查命令是：

```bash
npm test
npm run check:examples
npm run check
```

其中：
- `npm test` 覆盖 CLI 的行为测试
- `npm run check:examples` 会实际构建 `examples/basic` 和 `examples/project`
- `npm run check` 会把测试、fixtures 检查、examples 检查一起跑完

## 输出目录约定

默认目录：
- build 输出：`dist/`
- dev 输出：`.markos-dev/`
- 临时工作目录：`.markos-work/<output-name>/`

这些目录都可以通过 CLI 参数覆盖。

## 和服务端模式的区别

CLI 使用的是“本地作者模式”：
- 更偏向真实本地工程目录
- 允许保留本地资源引用
- 不依赖 HTTP / gRPC 请求协议

服务端使用的是“托管模式”：
- 更强调稳定输入和可控托管
- 会保留 preview session、命名 preview、R2 发布等能力
- 继续兼容现有服务协议

## 当前限制

- 当前只支持 `web`
- 不支持 `pdf` / `pptx`
- 不支持 `markos export`
- 没有主题市场和插件系统

如果未来要像 Slidev 一样继续向个人用户增强，`export`、主题分发和更完整的作者体验会是下一阶段重点。
