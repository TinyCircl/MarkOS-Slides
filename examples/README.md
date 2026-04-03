# Examples

这个目录提供两个最小可运行示例：

- `basic/`
  最小单文件 deck
- `project/`
  带 `styles/` 和 `assets/` 的本地作者项目

构建示例：

```bash
node src/cli.mjs build examples/basic/slides.md --out-dir .markos-example-basic
node src/cli.mjs build examples/project/slides.md --out-dir .markos-example-project
```

本地预览：

```bash
node src/cli.mjs dev examples/project/slides.md --port 3030
```
