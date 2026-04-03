# Commit Message Convention

## Format

每个 commit message 需同时包含英文和中文两段，中间空一行。每条 bullet point 只描述一个独立改动，不要将多个不相关的点合并在同一条内，但也无需拆分得过于细碎。条目数量灵活掌握，多少条都可以。commit message 只描述暂存区内的改动，不涉及未暂存的内容。

```
<type>(<scope>): <short summary in English>
* <what changed and why>

<type>(<scope>): <中文简要说明>
* <改动说明>
```

## Example

```
fix(slides): restore shared slide scroll while keeping the shell visually neutral
* Move slide preview and markdown back into a shared hidden middle scroll container
* Switch the slide editor pane to external scroll mode to avoid nested markdown scrollbars
* Align the preview card and markdown card to the same measured column width
* Blend the outer middle surface into the workspace canvas so only the two slide cards read as panels
* Render dropdown submenus through a portal so nested menus are not clipped

fix(slides): 恢复 slides 共享滚动，同时保持外层壳体视觉中性
* 将 slide 预览区和 markdown 区重新放回同一个隐藏 scrollbar 的 middle 共享滚动容器
* 让 slides editor 切到外层滚动模式，避免 markdown 区出现嵌套滚动条
* 让预览卡片和 markdown 卡片共用同一套测量列宽，始终保持对齐
* 让外层 middle surface 融入 workspace 背景，只让两张 slide 卡片本身读出来
* 让下拉二级菜单通过 portal 渲染，避免被父级裁切
```
