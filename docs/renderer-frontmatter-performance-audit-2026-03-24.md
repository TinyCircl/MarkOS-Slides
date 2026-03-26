# Renderer Frontmatter 性能审计

日期：2026-03-24

## 本次已落地的改动

已在 renderer 入口强制覆盖：

```yaml
download: false
seoMeta.ogImage: false
```

修改位置：

- `src/render-manager.mjs`

目的：

- 预览 / SPA 静态站点构建时，不再因为 deck 自带的 `download: true` 而在 `slidev build` 完成后自动再导出一轮 PDF
- 保留 CLI 原生能力不变
- 需要 PDF 时，仍然走显式导出命令或显式导出接口

## 改动效果验证

使用 `test/fixtures/markdown/nCine_14Years_Presentation.txt` 复测：

### 改动前

| 路径 | 冷启动耗时 |
| --- | ---: |
| `buildPreviewSite()` | 25.71 s |
| HTTP `POST /api/previews/build` | 23.72 s |

### 改动后

| 路径 | 冷启动耗时 |
| --- | ---: |
| `buildPreviewSite()` | 14.10 s |
| HTTP `POST /api/previews/build` | 14.72 s |

### 结论

仅关闭 `download`，这个 deck 的预览构建耗时就下降了大约：

- `buildPreviewSite()`：约 11.6 s
- HTTP 请求：约 9.0 s

这说明 `download: true` 是目前预览构建路径中最明确、最直接的高耗时放大器之一。

## 哪些顶部 frontmatter 参数会明显增加构建耗时

下面按“证据强度”分组。

### 第一组：高确定性，会直接放大构建时间

#### 1. `download: true | 'true' | 'auto'`

影响：

- `slidev build` 在构建完 SPA 后，会额外再跑一轮 `exportSlides(...)` 去生成 PDF

代码依据：

- `packages/slidev/node/commands/build.ts`

建议：

- 预览构建统一强制 `download: false`
- 真正需要 PDF 时显式走导出命令

#### 2. `seoMeta.ogImage: auto`

影响：

- `slidev build` 在构建后会额外启动静态服务并导出首屏 PNG，生成 `og-image.png`

代码依据：

- `packages/slidev/node/commands/build.ts`
- `packages/slidev/node/setups/indexHtml.ts`

建议：

- 托管预览场景通常不需要自动生成 OG 图
- 如果未来继续遇到构建偏慢，`seoMeta.ogImage` 是下一个值得强制覆盖的对象

#### 3. `remoteAssets: true | 'build'`

影响：

- 构建阶段会启用 `vite-plugin-remote-assets`
- 在 `build` 模式下会等待远程资源下载完成

代码依据：

- `packages/slidev/node/vite/remoteAssets.ts`

建议：

- 托管 renderer 应默认关闭
- 当前 renderer 已强制 `remoteAssets: false`

#### 4. `twoslash: true | 'build'`

影响：

- 构建时会在 Shiki 高亮链路里额外加载 twoslash transformer
- 会触发额外的 TypeScript 语义处理

代码依据：

- `packages/slidev/node/syntax/markdown-it/markdown-it-shiki.ts`

建议：

- 如果服务端不需要 twoslash 交互信息，可以考虑后续强制关闭
- 当前 renderer 还没有覆盖它

#### 5. `addons`

影响：

- 会解析并递归加载 addon 包
- addon 可能继续引入额外插件、资源和构建逻辑

代码依据：

- `packages/slidev/node/integrations/addons.ts`

建议：

- 托管场景若不允许第三方扩展，应限制或过滤

### 第二组：高概率增加构建量或构建成本

#### 6. `theme`

影响：

- 不同主题会引入不同布局、样式、静态资源，甚至额外配置
- 某些主题会显著增加依赖和构建体量

建议：

- 不是所有主题都同样重
- 如果后续要继续收敛耗时，建议限制允许主题的范围

#### 7. `monaco: true`

影响：

- 会保留 Monaco 相关功能和依赖
- 代码编辑、类型依赖、相关 chunk 都会变重

建议：

- 当前 renderer 已强制 `monaco: false`

#### 8. `monacoTypesSource` / `monacoTypesAdditionalPackages`

影响：

- 会扩展 Monaco 侧的类型加载和包解析
- 对构建和依赖扫描都有额外负担

建议：

- 如果未来允许 Monaco，再单独评估这些项

### 第三组：更偏向增加 bundle / 页面特性，构建时间影响通常次一级

#### 9. `presenter`

影响：

- 会打开 presenter 相关特性

当前 renderer：

- 已强制 `presenter: false`

#### 10. `record`

影响：

- 会打开录制相关特性和依赖

当前 renderer：

- 已强制 `record: false`

#### 11. `browserExporter`

影响：

- 会保留浏览器导出相关能力

当前 renderer：

- 已强制 `browserExporter: false`

#### 12. `drawings`

影响：

- 会启用绘图状态与相关服务端同步能力

当前 renderer：

- 已强制 `drawings.enabled: false`

#### 13. `preloadImages`

影响：

- 更偏运行时行为，不是主要编译瓶颈

当前 renderer：

- 已强制 `preloadImages: false`

#### 14. `info`

影响：

- 会在构建时渲染一段 markdown 到配置里
- 一般不是大头，但内容特别大时也会增加一些处理

## 不在顶部 frontmatter，但同样会明显放大耗时的内容因素

这部分不属于“顶部 yml 参数”，但在你们当前场景里同样很重要：

### 1. 非法 HTML

影响：

- fault-tolerant 模式下会触发单页恢复逻辑

结果：

- 增加额外的编译校验和恢复成本

### 2. 本地路径资源引用

影响：

- 原始 deck 可能直接构建失败
- renderer 需要先做路径清洗和裁剪

### 3. 大量 Mermaid / 图表 / 大页面内容

影响：

- 会增加 chunk 数量、依赖体积和实际 Vite 构建时间

## 当前 renderer 已经强制关闭的高风险项

当前 `SERVICE_FORCED_FRONTMATTER` 已覆盖：

- `download: false`
- `faultTolerance: true`
- `seoMeta.ogImage: false`
- `monaco: false`
- `presenter: false`
- `drawings: {enabled: false}`
- `wakeLock: false`
- `record: false`
- `browserExporter: false`
- `codeCopy: false`
- `contextMenu: false`
- `preloadImages: false`
- `remoteAssets: false`

## 下一步建议

如果目标是继续稳定压缩托管预览的构建时间，优先级建议如下：

1. 保持 `download: false`
2. 评估是否还要统一覆盖 `seoMeta.ogImage`
3. 评估是否要统一关闭 `twoslash`
4. 限制 `addons` 和 `theme` 的允许范围
5. 继续收敛输入内容中的非法 HTML 和本地路径资源引用
