import {marked} from "marked";
import {APP_CSS, BASE_CSS, FONT_PRECONNECT} from "./styles.mjs";

marked.setOptions({
    breaks: true,
    gfm: true,
});

function splitTwoCols(content) {
    const parts = content.split(/\n::right::\n/);
    if (parts.length < 2) {
        return {
            left: content,
            right: "",
        };
    }

    return {
        left: parts[0].trim(),
        right: parts.slice(1).join("\n::right::\n").trim(),
    };
}

function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll("\"", "&quot;");
}

function stripMarkdown(value) {
    return value
        .replace(/`([^`]+)`/g, "$1")
        .replace(/\*\*([^*]+)\*\*/g, "$1")
        .replace(/\*([^*]+)\*/g, "$1")
        .replace(/!\[[^\]]*]\([^)]+\)/g, "")
        .replace(/\[([^\]]+)]\([^)]+\)/g, "$1")
        .replace(/^#{1,6}\s+/gm, "")
        .replace(/^\s*[-*+]\s+/gm, "")
        .replace(/^\s*\d+\.\s+/gm, "")
        .trim();
}

function renderMarkdown(content) {
    return marked.parse(content);
}

function renderMarkdownTokens(tokens) {
    return Array.isArray(tokens) && tokens.length > 0 ? marked.parser(tokens) : "";
}

function paragraphContainsImage(token) {
    return token?.type === "paragraph"
        && typeof token.raw === "string"
        && (token.raw.includes("![") || token.raw.includes("<img"));
}

function splitTwoColsHeader(content) {
    const tokens = marked.lexer(content);
    let index = 0;

    while (tokens[index]?.type === "space") {
        index += 1;
    }

    const firstToken = tokens[index];
    if (!firstToken || firstToken.type !== "heading" || firstToken.depth !== 1) {
        return {
            header: "",
            body: renderMarkdown(content),
        };
    }

    const headerTokens = [firstToken];
    index += 1;

    while (index < tokens.length) {
        const token = tokens[index];
        if (token.type === "space") {
            index += 1;
            continue;
        }

        if (token.type === "paragraph" && !paragraphContainsImage(token)) {
            headerTokens.push(token);
            index += 1;
            continue;
        }

        if (token.type === "heading" && token.depth <= 2) {
            headerTokens.push(token);
            index += 1;
            continue;
        }

        break;
    }

    return {
        header: renderMarkdownTokens(headerTokens),
        body: renderMarkdownTokens(tokens.slice(index)),
    };
}

function toClassName(...values) {
    return values.filter(Boolean).join(" ");
}

function tokenizeClassNames(value) {
    return typeof value === "string"
        ? value.split(/\s+/).map((token) => token.trim()).filter(Boolean)
        : [];
}

const KNOWN_TEMPLATES = new Set([
    "title",
    "toc",
    "section-divider",
    "body",
    "two-column",
    "image-text",
    "full-bleed-image",
    "closing",
    "implementation-process",
]);

function normalizeTemplateToken(token) {
    if (typeof token !== "string" || !token.trim()) {
        return "";
    }

    return token.trim();
}

function resolveSlideTemplate(slide) {
    const tokens = [
        ...tokenizeClassNames(slide.frontmatter?.class),
        ...tokenizeClassNames(slide.frontmatter?.layoutClass),
    ];
    const namedTemplate = tokens
        .map((token) => normalizeTemplateToken(token))
        .findLast((token) => KNOWN_TEMPLATES.has(token));
    if (namedTemplate) {
        return namedTemplate;
    }

    return typeof slide.frontmatter?.layout === "string" && slide.frontmatter.layout.trim()
        ? slide.frontmatter.layout.trim()
        : "default";
}

function extractLeadingSectionNumber(slide) {
    const titleSource = extractSlideTitle(slide, 0);
    const match = titleSource.match(/^\s*(\d{1,3})\b/);
    return match ? match[1] : "";
}

function renderSlideHtml(slide) {
    const layout = typeof slide.frontmatter.layout === "string" ? slide.frontmatter.layout : "default";
    const slideClass = typeof slide.frontmatter.class === "string" ? slide.frontmatter.class : undefined;
    const background = typeof slide.frontmatter.background === "string" ? slide.frontmatter.background : undefined;
    const style = background ? ` style="background: ${escapeHtml(background)}"` : "";

    if (layout === "cover") {
        const className = toClassName("slidev-layout cover", slideClass);
        const template = resolveSlideTemplate(slide);
        const sectionNumber = template === "section-divider" ? extractLeadingSectionNumber(slide) : "";
        const sectionNumberAttr = sectionNumber ? ` data-markos-section-number="${escapeHtml(sectionNumber)}"` : "";
        return `<div class="${className}" data-markos-role="slide-layout" data-markos-layout="cover"${style}><div class="my-auto w-full" data-markos-role="cover-content"${sectionNumberAttr}>${renderMarkdown(slide.content)}</div></div>`;
    }

    if (layout === "two-cols") {
        const sections = splitTwoCols(slide.content);
        const leftSection = splitTwoColsHeader(sections.left);
        const className = toClassName(
            "slidev-layout two-columns w-full h-full grid grid-cols-2",
            typeof slide.frontmatter.layoutClass === "string" ? slide.frontmatter.layoutClass : undefined,
        );
        return [
            `<div class="${className}" data-markos-role="slide-layout" data-markos-layout="two-cols">`,
            leftSection.header ? `<div class="two-cols-header" data-markos-role="header">${leftSection.header}</div>` : "",
            `<div class="${toClassName("col-left", slideClass)}" data-markos-role="column-left">${leftSection.body}</div>`,
            `<div class="${toClassName("col-right", slideClass)}" data-markos-role="column-right">${renderMarkdown(sections.right)}</div>`,
            "</div>",
        ].join("");
    }

    const className = toClassName("slidev-layout default", slideClass);
    return `<div class="${className}" data-markos-role="slide-layout" data-markos-layout="default"${style}>${renderMarkdown(slide.content)}</div>`;
}

function extractSlideTitle(slide, index) {
    if (typeof slide.frontmatter?.title === "string" && slide.frontmatter.title.trim()) {
        return slide.frontmatter.title.trim();
    }

    const headingMatch = slide.content.match(/^#{1,6}\s+(.+)$/m);
    if (headingMatch) {
        return stripMarkdown(headingMatch[1]).trim();
    }

    const firstMeaningfulLine = slide.content
        .split("\n")
        .map((line) => line.trim())
        .find((line) => line.length > 0 && line !== "::right::");

    if (firstMeaningfulLine) {
        return stripMarkdown(firstMeaningfulLine).slice(0, 48);
    }

    return `Slide ${index + 1}`;
}

function serializeForScript(value) {
    return JSON.stringify(value)
        .replaceAll("<", "\\u003c")
        .replaceAll("\u2028", "\\u2028")
        .replaceAll("\u2029", "\\u2029");
}

function normalizeBasePath(path) {
    return path.endsWith("/") ? path : `${path}/`;
}

function buildAssetHref(basePath, relativePath) {
    return `${normalizeBasePath(basePath)}${relativePath.replace(/^\/+/, "")}`;
}

export function getRenderedSlides(deck) {
    return deck.slides.map((slide, index) => ({
        index,
        title: extractSlideTitle(slide, index),
        template: resolveSlideTemplate(slide),
        html: renderSlideHtml(slide),
        frontmatter: slide.frontmatter,
    }));
}

function buildRuntimeScript(payload) {
    const serialized = serializeForScript(payload);
    return `
<script id="__MARKOS_DECK__" type="application/json">${serialized}</script>
<script>
(() => {
  const deckData = JSON.parse(document.getElementById('__MARKOS_DECK__').textContent);
  const slides = deckData.slides;
  const app = document.getElementById('app');
  const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('markos-slides') : null;
  const storageKey = 'markos-slides:index';
  let index = 0;

  function clamp(value) {
    return Math.max(0, Math.min(slides.length - 1, value));
  }

  function normalizeBasePath(path) {
    return path.endsWith('/') ? path : path + '/';
  }

  function currentMode() {
    const basePath = normalizeBasePath(deckData.basePath || '/');
    const pathname = window.location.pathname;
    const relativePath = pathname.startsWith(basePath) ? pathname.slice(basePath.length) : pathname.replace(/^\\/+/, '');
    if (relativePath.startsWith('presenter')) return 'presenter';
    if (relativePath.startsWith('overview')) return 'overview';
    if (relativePath.startsWith('export')) return 'export';
    return 'show';
  }

  function modePath(mode) {
    const basePath = normalizeBasePath(deckData.basePath || '/');
    if (mode === 'show') return basePath;
    return normalizeBasePath(basePath + mode + '/');
  }

  function readIndexFromLocation() {
    const params = new URLSearchParams(window.location.search);
    const raw = Number.parseInt(params.get('slide') || '1', 10);
    return clamp(Number.isNaN(raw) ? 0 : raw - 1);
  }

  function updateUrl(replaceState) {
    const mode = currentMode();
    const url = new URL(window.location.href);
    url.pathname = modePath(mode);
    url.searchParams.set('slide', String(index + 1));
    const method = replaceState ? 'replaceState' : 'pushState';
    window.history[method](null, '', url);
  }

  function announce() {
    localStorage.setItem(storageKey, JSON.stringify({ index, at: Date.now() }));
    if (channel) channel.postMessage({ type: 'slide-change', index });
  }

  function modeLink(mode, slideIndex = index) {
    return modePath(mode) + '?slide=' + String(slideIndex + 1);
  }

  function shouldCollectExportModel() {
    if (currentMode() !== 'export') return false;
    const params = new URLSearchParams(window.location.search);
    return params.get('collect') === '1';
  }

  function updateViewportScale() {
    const canvas = document.getElementById('slide-canvas');
    if (!canvas || !deckData.viewport) return;
    const width = Number(deckData.viewport.canvasWidth) || 1280;
    const height = Number(deckData.viewport.canvasHeight) || 720;
    const scale = Math.min(window.innerWidth / width, window.innerHeight / height);
    canvas.style.transform = 'scale(' + scale + ')';
  }

  function renderShow() {
    const current = slides[index];
    document.body.className = 'markos-shell';
    app.innerHTML = '<main class="viewer-stage is-plain"><div class="viewer-root" aria-label="slide viewport"><div id="slide-canvas" class="viewer-canvas"><div class="slide-page is-live">' + current.html + '</div></div></div></main>';
    document.title = deckData.title + ' (' + String(index + 1) + '/' + String(slides.length) + ')';
    updateViewportScale();
  }

  function renderPresenter() {
    const current = slides[index];
    const next = index + 1 < slides.length ? slides[index + 1] : null;
    document.body.className = 'markos-shell presenter-shell';
    app.innerHTML = [
      '<main class="app-frame presenter-shell">',
      '<header class="app-topbar">',
      '<div class="app-brand"><img class="app-logo" src="' + deckData.iconHref + '" alt="MarkOS logo"><div class="app-brand-copy"><strong>Presenter Mode</strong><span id="presenter-counter">' + String(index + 1).padStart(2, '0') + ' / ' + String(slides.length).padStart(2, '0') + '</span></div></div>',
      '<div class="app-actions">',
      '<button id="prev" class="app-button" type="button">Prev</button>',
      '<button id="next" class="app-button" type="button">Next</button>',
      '<a class="app-link" href="' + modeLink('show') + '">Slides</a>',
      '<a class="app-link" href="' + modeLink('overview') + '">Overview</a>',
      '<a class="app-link" href="' + modeLink('export') + '">Export</a>',
      '</div></header>',
      '<section class="presenter-grid">',
      '<div class="presenter-panel"><h2>' + current.title + '</h2><div class="presenter-stack"><div class="slide-page">' + current.html + '</div></div></div>',
      '<div class="presenter-stack">',
      '<div class="presenter-panel"><h2>' + (next ? next.title : 'End of deck') + '</h2><div>' + (next ? '<div class="slide-page">' + next.html + '</div>' : '<div class="slidev-layout default empty-state"><div>End of deck</div></div>') + '</div></div>',
      '<aside class="presenter-sidebar"><h2>Shortcuts</h2><p><span class="presenter-kbd">←</span> <span class="presenter-kbd">→</span> Navigate slides</p><p><span class="presenter-kbd">Home</span> First slide, <span class="presenter-kbd">End</span> Last slide</p><p>Use the main slide view for direct navigation.</p></aside>',
      '</div></section></main>'
    ].join('');
    document.title = deckData.title + ' Presenter (' + String(index + 1) + '/' + String(slides.length) + ')';
    document.getElementById('prev').addEventListener('click', () => setIndex(index - 1));
    document.getElementById('next').addEventListener('click', () => setIndex(index + 1));
  }

  function renderOverview() {
    document.body.className = 'markos-shell';
    app.innerHTML = [
      '<main class="app-frame">',
      '<header class="app-topbar"><div class="app-brand"><img class="app-logo" src="' + deckData.iconHref + '" alt="MarkOS logo"><div class="app-brand-copy"><strong>Slides Overview</strong><span>' + deckData.title + '</span></div></div><div class="app-actions"><a class="app-link" href="' + modeLink('show') + '">Slides</a><a class="app-link" href="' + modeLink('presenter') + '">Presenter</a><a class="app-link" href="' + modeLink('export') + '">Export</a></div></header>',
      '<section class="overview-grid">',
      slides.map((slide, slideIndex) => '<a class="overview-card' + (slideIndex === index ? ' is-active' : '') + '" data-slide-card="' + slideIndex + '" href="' + modeLink('show', slideIndex) + '"><div class="overview-meta"><span class="overview-index">Slide ' + String(slideIndex + 1).padStart(2, '0') + '</span><span class="overview-title">' + slide.title + '</span></div><div class="overview-preview"><div class="slide-page">' + slide.html + '</div></div></a>').join(''),
      '</section></main>',
    ].join('');
    document.title = deckData.title + ' Overview';
    Array.from(document.querySelectorAll('[data-slide-card]')).forEach((card, cardIndex) => {
      card.addEventListener('click', () => {
        localStorage.setItem(storageKey, JSON.stringify({ index: cardIndex, at: Date.now() }));
        if (channel) channel.postMessage({ type: 'slide-change', index: cardIndex });
      });
    });
  }

  function renderExport() {
    document.body.className = '';
    app.innerHTML = '<main class="presentation is-export">' + slides.map((slide) => '<section class="slide-page" data-markos-role="slide" data-markos-template="' + String(slide.template || 'default').replace(/"/g, '&quot;') + '" data-markos-slide-index="' + String(slide.index) + '" data-markos-slide-title="' + String(slide.title || '').replace(/"/g, '&quot;') + '">' + slide.html + '</section>').join('') + '</main>';
    document.title = deckData.title + ' Export';
    if (shouldCollectExportModel()) {
      void collectAndEmbedExportModel();
    }
  }

  function parsePx(value) {
    const parsed = Number.parseFloat(String(value || '').replace('px', '').trim());
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function isTransparentColor(value) {
    const normalized = String(value || '').trim().toLowerCase();
    return !normalized || normalized === 'transparent' || normalized === 'rgba(0, 0, 0, 0)' || normalized === 'rgba(0,0,0,0)';
  }

  function isVisibleElement(element, style) {
    const rect = element.getBoundingClientRect();
    return style.display !== 'none'
      && style.visibility !== 'hidden'
      && Number.parseFloat(style.opacity || '1') > 0
      && rect.width > 0.5
      && rect.height > 0.5;
  }

  function toRelativeRect(rect, slideRect) {
    return {
      x: Math.max(0, rect.left - slideRect.left),
      y: Math.max(0, rect.top - slideRect.top),
      w: rect.width,
      h: rect.height,
    };
  }

  function firstFontFamily(value) {
    return String(value || '')
      .split(',')
      .map((part) => part.trim().replace(/^['"]|['"]$/g, ''))
      .find(Boolean) || 'Arial';
  }

  function borderMetrics(style) {
    return {
      topWidth: parsePx(style.borderTopWidth),
      rightWidth: parsePx(style.borderRightWidth),
      bottomWidth: parsePx(style.borderBottomWidth),
      leftWidth: parsePx(style.borderLeftWidth),
      topColor: style.borderTopColor,
      rightColor: style.borderRightColor,
      bottomColor: style.borderBottomColor,
      leftColor: style.borderLeftColor,
    };
  }

  function shapeTypeForElement(rect, style) {
    const radius = Math.max(
      parsePx(style.borderTopLeftRadius),
      parsePx(style.borderTopRightRadius),
      parsePx(style.borderBottomRightRadius),
      parsePx(style.borderBottomLeftRadius),
    );
    const minSize = Math.min(rect.width, rect.height);
    if (radius >= (minSize / 2) - 1 && Math.abs(rect.width - rect.height) <= 3) {
      return 'ellipse';
    }
    if (radius > 2) {
      return 'roundRect';
    }
    return 'rect';
  }

  function shouldCollectShape(element, slideElement) {
    if (element === slideElement) return false;
    if (element.dataset.markosExport === 'ignore') return false;
    const style = getComputedStyle(element);
    if (!isVisibleElement(element, style)) return false;
    if (element.tagName === 'IMG') return false;
    if (element.dataset.markosRole === 'slide-layout') return false;
    if (element.dataset.markosRole === 'header') return false;
    if (element.dataset.markosRole === 'column-left') return false;
    if (element.dataset.markosRole === 'column-right') return false;

    const borders = borderMetrics(style);
    const hasVisibleBorder = (
      (borders.topWidth > 0 && !isTransparentColor(borders.topColor))
      || (borders.rightWidth > 0 && !isTransparentColor(borders.rightColor))
      || (borders.bottomWidth > 0 && !isTransparentColor(borders.bottomColor))
      || (borders.leftWidth > 0 && !isTransparentColor(borders.leftColor))
    );
    const hasVisibleFill = !isTransparentColor(style.backgroundColor);
    const hasVisibleShadow = style.boxShadow && style.boxShadow !== 'none';

    return hasVisibleFill || hasVisibleBorder || hasVisibleShadow;
  }

  function collectShapeNodes(slideElement, slideRect, slideIndex) {
    const nodes = [];
    let order = 0;

    for (const element of slideElement.querySelectorAll('*')) {
      if (!shouldCollectShape(element, slideElement)) continue;

      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      const relative = toRelativeRect(rect, slideRect);
      const borders = borderMetrics(style);
      const borderSides = [
        borders.topWidth > 0 && !isTransparentColor(borders.topColor),
        borders.rightWidth > 0 && !isTransparentColor(borders.rightColor),
        borders.bottomWidth > 0 && !isTransparentColor(borders.bottomColor),
        borders.leftWidth > 0 && !isTransparentColor(borders.leftColor),
      ];
      const visibleBorderCount = borderSides.filter(Boolean).length;
      const fillColor = style.backgroundColor;

      if (visibleBorderCount === 1 && isTransparentColor(fillColor)) {
        if (borderSides[0]) {
          nodes.push({
            id: element.dataset.markosNodeId || 'slide-' + String(slideIndex + 1) + '.shape.' + String(++order),
            kind: 'shape',
            role: element.dataset.markosRole || 'accent-bar',
            order,
            shape: 'rect',
            x: relative.x,
            y: relative.y,
            w: relative.w,
            h: borders.topWidth,
            fillColor: borders.topColor,
            lineColor: 'transparent',
            lineWidthPx: 0,
            borderRadiusPx: 0,
          });
          continue;
        }
        if (borderSides[1]) {
          nodes.push({
            id: element.dataset.markosNodeId || 'slide-' + String(slideIndex + 1) + '.shape.' + String(++order),
            kind: 'shape',
            role: element.dataset.markosRole || 'accent-bar',
            order,
            shape: 'rect',
            x: relative.x + relative.w - borders.rightWidth,
            y: relative.y,
            w: borders.rightWidth,
            h: relative.h,
            fillColor: borders.rightColor,
            lineColor: 'transparent',
            lineWidthPx: 0,
            borderRadiusPx: 0,
          });
          continue;
        }
        if (borderSides[2]) {
          nodes.push({
            id: element.dataset.markosNodeId || 'slide-' + String(slideIndex + 1) + '.shape.' + String(++order),
            kind: 'shape',
            role: element.dataset.markosRole || 'accent-bar',
            order,
            shape: 'rect',
            x: relative.x,
            y: relative.y + relative.h - borders.bottomWidth,
            w: relative.w,
            h: borders.bottomWidth,
            fillColor: borders.bottomColor,
            lineColor: 'transparent',
            lineWidthPx: 0,
            borderRadiusPx: 0,
          });
          continue;
        }
        if (borderSides[3]) {
          nodes.push({
            id: element.dataset.markosNodeId || 'slide-' + String(slideIndex + 1) + '.shape.' + String(++order),
            kind: 'shape',
            role: element.dataset.markosRole || 'accent-bar',
            order,
            shape: 'rect',
            x: relative.x,
            y: relative.y,
            w: borders.leftWidth,
            h: relative.h,
            fillColor: borders.leftColor,
            lineColor: 'transparent',
            lineWidthPx: 0,
            borderRadiusPx: 0,
          });
          continue;
        }
      }

      nodes.push({
        id: element.dataset.markosNodeId || 'slide-' + String(slideIndex + 1) + '.shape.' + String(++order),
        kind: 'shape',
        role: element.dataset.markosRole || 'panel',
        order,
        shape: shapeTypeForElement(rect, style),
        x: relative.x,
        y: relative.y,
        w: relative.w,
        h: relative.h,
        fillColor,
        lineColor: visibleBorderCount > 0 ? (borders.leftColor || borders.topColor || borders.rightColor || borders.bottomColor) : 'transparent',
        lineWidthPx: Math.max(borders.topWidth, borders.rightWidth, borders.bottomWidth, borders.leftWidth),
        borderRadiusPx: Math.max(
          parsePx(style.borderTopLeftRadius),
          parsePx(style.borderTopRightRadius),
          parsePx(style.borderBottomRightRadius),
          parsePx(style.borderBottomLeftRadius),
        ),
      });
    }

    return nodes;
  }

  function collectTextNodes(slideElement, slideRect, slideIndex) {
    const nodes = [];
    let order = 0;
    const selector = 'h1,h2,h3,h4,h5,h6,p,figcaption,pre,ul,ol,td,th';

    for (const element of slideElement.querySelectorAll(selector)) {
      if (element.dataset.markosExport === 'ignore') continue;
      if ((element.tagName === 'TD' || element.tagName === 'TH') && element.closest('table')?.dataset.markosExport === 'ignore') continue;
      if ((element.tagName === 'P' || element.tagName === 'FIGCAPTION' || element.tagName === 'PRE') && element.closest('blockquote,article,aside,section')) {
        // Still collect these. The surrounding panel shape is exported separately.
      }

      const style = getComputedStyle(element);
      if (!isVisibleElement(element, style)) continue;

      let text = '';
      let role = element.dataset.markosRole || element.tagName.toLowerCase();

      if (element.tagName === 'UL' || element.tagName === 'OL') {
        const items = Array.from(element.children)
          .filter((child) => child.tagName === 'LI')
          .map((child) => child.innerText.trim())
          .filter(Boolean);
        if (items.length === 0) continue;
        text = items.map((item) => '• ' + item).join('\\\\n');
        role = 'list';
      } else {
        text = element.innerText.trim();
      }

      if (!text) continue;

      const rect = element.getBoundingClientRect();
      const relative = toRelativeRect(rect, slideRect);
      nodes.push({
        id: element.dataset.markosNodeId || 'slide-' + String(slideIndex + 1) + '.text.' + String(++order),
        kind: 'text',
        role,
        order,
        x: relative.x,
        y: relative.y,
        w: relative.w,
        h: relative.h,
        text,
        fontFamily: firstFontFamily(style.fontFamily),
        fontSizePx: parsePx(style.fontSize),
        fontWeight: style.fontWeight,
        fontStyle: style.fontStyle,
        textAlign: style.textAlign,
        color: style.color,
      });
    }

    return nodes;
  }

  function collectImageNodes(slideElement, slideRect, slideIndex) {
    const nodes = [];
    let order = 0;

    for (const element of slideElement.querySelectorAll('img')) {
      if (element.dataset.markosExport === 'ignore') continue;
      const style = getComputedStyle(element);
      if (!isVisibleElement(element, style)) continue;
      const rect = element.getBoundingClientRect();
      const relative = toRelativeRect(rect, slideRect);
      const src = element.currentSrc || element.src || '';
      if (!src) continue;

      nodes.push({
        id: element.dataset.markosNodeId || 'slide-' + String(slideIndex + 1) + '.image.' + String(++order),
        kind: 'image',
        role: element.dataset.markosRole || 'image',
        order,
        x: relative.x,
        y: relative.y,
        w: relative.w,
        h: relative.h,
        src,
      });
    }

    return nodes;
  }

  function resolveSlideBackground(slideElement) {
    const layoutElement = slideElement.querySelector('[data-markos-role="slide-layout"]') || slideElement.firstElementChild || slideElement;
    const style = getComputedStyle(layoutElement);
    return isTransparentColor(style.backgroundColor) ? 'rgb(255, 255, 255)' : style.backgroundColor;
  }

  async function waitForExportAssets() {
    if (document.fonts && typeof document.fonts.ready?.then === 'function') {
      try {
        await document.fonts.ready;
      } catch {}
    }

    const imagePromises = Array.from(document.images).map((image) => {
      if (image.complete) return Promise.resolve();
      return new Promise((resolve) => {
        image.addEventListener('load', resolve, { once: true });
        image.addEventListener('error', resolve, { once: true });
        window.setTimeout(resolve, 1500);
      });
    });
    await Promise.all(imagePromises);
  }

  function buildExportModelSnapshot() {
    const slideElements = Array.from(document.querySelectorAll('.presentation.is-export > .slide-page[data-markos-role="slide"]'));
    return {
      deck: {
        title: deckData.title,
        width: Number(deckData.viewport?.canvasWidth) || 1280,
        height: Number(deckData.viewport?.canvasHeight) || 720,
      },
      slides: slideElements.map((slideElement, slideIndex) => {
        const slideRect = slideElement.getBoundingClientRect();
        const shapeNodes = collectShapeNodes(slideElement, slideRect, slideIndex).map((node) => ({...node, layer: 1}));
        const imageNodes = collectImageNodes(slideElement, slideRect, slideIndex).map((node) => ({...node, layer: 2}));
        const textNodes = collectTextNodes(slideElement, slideRect, slideIndex).map((node) => ({...node, layer: 3}));
        return {
          index: slideIndex,
          title: slideElement.dataset.markosSlideTitle || ('Slide ' + String(slideIndex + 1)),
          template: slideElement.dataset.markosTemplate || 'default',
          backgroundColor: resolveSlideBackground(slideElement),
          nodes: [...shapeNodes, ...imageNodes, ...textNodes],
        };
      }),
    };
  }

  function appendExportModelScript(model) {
    const existing = document.getElementById('__MARKOS_EXPORT_MODEL__');
    if (existing) existing.remove();
    const script = document.createElement('script');
    script.id = '__MARKOS_EXPORT_MODEL__';
    script.type = 'application/json';
    script.textContent = JSON.stringify(model);
    document.body.appendChild(script);
  }

  async function collectAndEmbedExportModel() {
    await waitForExportAssets();
    const model = buildExportModelSnapshot();
    appendExportModelScript(model);
    window.__MARKOS_EXPORT_MODEL__ = model;
    return model;
  }

  window.__MARKOS_COLLECT_EXPORT_MODEL__ = collectAndEmbedExportModel;

  function render() {
    const mode = currentMode();
    if (mode === 'presenter') return renderPresenter();
    if (mode === 'overview') return renderOverview();
    if (mode === 'export') return renderExport();
    return renderShow();
  }

  function setIndex(nextIndex, options = {}) {
    const resolved = clamp(nextIndex);
    if (resolved === index && !options.force) return;
    index = resolved;
    render();
    updateUrl(Boolean(options.replaceState));
    if (options.broadcast !== false) announce();
  }

  function handleKeydown(event) {
    if (event.target && /input|textarea|select/i.test(event.target.tagName)) return;
    if (currentMode() === 'export') return;
    if (event.key === 'ArrowRight' || event.key === 'PageDown' || event.key === ' ') {
      event.preventDefault();
      setIndex(index + 1);
    } else if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
      event.preventDefault();
      setIndex(index - 1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      setIndex(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      setIndex(slides.length - 1);
    }
  }

  window.addEventListener('keydown', handleKeydown);
  window.addEventListener('resize', updateViewportScale);
  window.addEventListener('popstate', () => {
    index = readIndexFromLocation();
    render();
  });
  window.addEventListener('storage', (event) => {
    if (event.key !== storageKey || !event.newValue) return;
    try {
      const data = JSON.parse(event.newValue);
      setIndex(Number(data.index), { broadcast: false, replaceState: true });
    } catch {}
  });
  if (channel) {
    channel.onmessage = (event) => {
      if (event.data && event.data.type === 'slide-change') {
        setIndex(Number(event.data.index), { broadcast: false, replaceState: true });
      }
    };
  }

  index = readIndexFromLocation();
  render();
})();
</script>
`;
}

export function renderMarkosDocument({title, basePath, viewport, renderedSlides, bundledCss = ""}) {
    const viewportCss = `
.viewer-canvas {
  width: ${viewport.canvasWidth}px;
  height: ${viewport.canvasHeight}px;
}
.slide-page {
  width: ${viewport.canvasWidth}px;
  min-height: ${viewport.canvasHeight}px;
}
.presentation.is-export {
  gap: 0;
  padding: 0;
}
.presentation.is-export .slide-page {
  margin: 0;
}
@media print {
  @page {
    size: ${viewport.canvasWidth}px ${viewport.canvasHeight}px;
    margin: 0;
  }
  html,
  body {
    background: #fff;
  }
  .presentation.is-export,
  .presentation.is-export * {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
}
`;
    const iconHref = buildAssetHref(basePath, "assets/markdos-icon.svg");

    return [
        "<!doctype html>",
        '<html lang="zh-CN">',
        "<head>",
        '<meta charset="utf-8">',
        '<meta name="viewport" content="width=device-width, initial-scale=1">',
        `<title>${escapeHtml(title)}</title>`,
        `<meta name="slidev:aspect-ratio" content="${escapeHtml(viewport.aspectRatioText)}">`,
        `<link rel="icon" type="image/svg+xml" href="${escapeHtml(iconHref)}">`,
        FONT_PRECONNECT,
        `<style>${BASE_CSS}\n${APP_CSS}\n${viewportCss}\n${bundledCss}</style>`,
        "</head>",
        '<body class="markos-shell">',
        '<div id="app"></div>',
        buildRuntimeScript({
            title,
            basePath,
            iconHref,
            viewport,
            slides: renderedSlides.length > 0 ? renderedSlides : [{
                index: 0,
                title: "Empty Deck",
                html: '<div class="slidev-layout default empty-state"><div>No slides were generated.</div></div>',
            }],
        }),
        "</body>",
        "</html>",
    ].join("");
}
