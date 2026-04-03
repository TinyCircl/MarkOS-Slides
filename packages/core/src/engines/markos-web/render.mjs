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

function toClassName(...values) {
    return values.filter(Boolean).join(" ");
}

function renderSlideHtml(slide) {
    const layout = typeof slide.frontmatter.layout === "string" ? slide.frontmatter.layout : "default";
    const slideClass = typeof slide.frontmatter.class === "string" ? slide.frontmatter.class : undefined;
    const background = typeof slide.frontmatter.background === "string" ? slide.frontmatter.background : undefined;
    const style = background ? ` style="background: ${escapeHtml(background)}"` : "";

    if (layout === "cover") {
        const className = toClassName("slidev-layout cover", slideClass);
        return `<div class="${className}"${style}><div class="my-auto w-full">${renderMarkdown(slide.content)}</div></div>`;
    }

    if (layout === "two-cols") {
        const sections = splitTwoCols(slide.content);
        const className = toClassName(
            "slidev-layout two-columns w-full h-full grid grid-cols-2",
            typeof slide.frontmatter.layoutClass === "string" ? slide.frontmatter.layoutClass : undefined,
        );
        return [
            `<div class="${className}">`,
            `<div class="${toClassName("col-left", slideClass)}">${renderMarkdown(sections.left)}</div>`,
            `<div class="${toClassName("col-right", slideClass)}">${renderMarkdown(sections.right)}</div>`,
            "</div>",
        ].join("");
    }

    const className = toClassName("slidev-layout default", slideClass);
    return `<div class="${className}"${style}>${renderMarkdown(slide.content)}</div>`;
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
    app.innerHTML = '<main class="presentation is-export">' + slides.map((slide) => '<section class="slide-page">' + slide.html + '</section>').join('') + '</main>';
    document.title = deckData.title + ' Export';
  }

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
