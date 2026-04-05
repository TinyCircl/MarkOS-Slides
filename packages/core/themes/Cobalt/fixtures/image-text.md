---
theme: Cobalt
title: Cobalt Single Image Fixture
---

---
layout: two-cols
layoutClass: slide-shell image-text
title: 城市视角
---

# 城市视角

这是标准的图文页：左侧图片，右侧说明。

![Xi'an city wall at night](https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1800&q=80)

::right::

## 为什么适合做图文页

右侧需要保留标题和说明，图片只是叙事的一半，而不是整页的唯一内容。

## 适配目标

图片和说明文字要同时成立，不能再切换成单图模式。

---
layout: two-cols
layoutClass: slide-shell image-text
title: 竖图 + 说明
---

# 竖图 + 说明

图片仍然要服从标题下面的正文空间。

![Portrait city scene](https://images.unsplash.com/photo-1493246507139-91e8fad9978e?auto=format&fit=crop&w=900&h=1400&q=80)

::right::

## 竖图也要稳定

当图片本身比例偏高时，模板应该根据正文剩余空间收缩高度，而不是把标题区顶掉。

## 文本优先级

标题、说明段落和列表都应该保持清晰可读。

---
layout: two-cols
layoutClass: slide-shell image-text
title: 方图 + 多要点
---

# 方图 + 多要点

图像比例变化时，标题和说明仍应稳定成立。

![Square market view](https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=1200&h=1200&q=80)

::right::

## 适合的写法

这是标准的图文页，不是单图页。

## 右侧内容

- 一侧放图片
- 一侧放标题和描述
- 允许多个要点

---
layout: two-cols
layoutClass: slide-shell image-text
title: 误用检查
---

# 误用检查

这里仍然是图文页，不是单图页。

![Single image should not become full bleed](https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?auto=format&fit=crop&w=1800&q=80)

::right::

## 不支持单图模式

如果只想展示一张满版图片，应改用 `full-bleed-image`，而不是让 `image-text` 退化成特殊模式。
