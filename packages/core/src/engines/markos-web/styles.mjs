export const FONT_PRECONNECT = `
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous">
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&display=swap" rel="stylesheet">
`;

export const BASE_CSS = `
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #ece9e4; }
body { font-family: 'Montserrat', 'Helvetica Neue', Arial, sans-serif; color: #2d2d2d; }
a { color: inherit; }
.w-full { width: 100%; }
.h-full { height: 100%; }
.grid { display: grid; }
.grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.my-auto { margin-top: auto; margin-bottom: auto; }
.text-left { text-align: left; }
.presentation {
  display: flex;
  flex-direction: column;
  gap: 32px;
  padding: 32px;
}
.slide-page {
  width: 1280px;
  min-height: 720px;
  margin: 0 auto;
  position: relative;
  overflow: hidden;
  background: #f5f5f5;
  page-break-after: always;
}
.slidev-layout.default {
  width: 100%;
  min-height: 720px;
  padding: 24px 60px;
}
.slidev-layout {
  height: 100%;
  padding: 2.5rem 3.5rem;
  font-size: 1.1rem;
}
.slidev-layout pre,
.slidev-layout code {
  user-select: text;
}
.slidev-layout code {
  font-family: 'Fira Code', 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
}
.slidev-layout h1 {
  margin-top: 0;
  margin-right: 0;
  margin-bottom: 1rem;
  margin-left: -0.05em;
  font-size: 2.25rem;
}
.slidev-layout h2 {
  margin-top: 0;
  margin-bottom: 0.5rem;
  font-size: 1.875rem;
}
.slidev-layout h3 {
  margin-top: 0;
  margin-bottom: 0.5rem;
  font-size: 1.5rem;
}
.slidev-layout h4 {
  margin-top: 0;
  margin-bottom: 0.5rem;
  font-size: 1.25rem;
}
.slidev-layout h5 {
  margin-top: 0;
  margin-bottom: 0.5rem;
  font-size: 1rem;
}
.slidev-layout h6 {
  margin-top: 0;
  margin-right: 0;
  margin-bottom: 0.5rem;
  margin-left: -0.05em;
  padding-top: 0.25rem;
  font-size: 0.875rem;
  font-weight: 500;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
.slidev-layout p {
  margin: 1rem 0;
  line-height: 1.5;
}
.slidev-layout ul {
  list-style: square;
}
.slidev-layout ol {
  list-style: decimal;
}
.slidev-layout li {
  margin-left: 1.1em;
  padding-left: 0.2em;
  line-height: 1.8em;
}
.slidev-layout blockquote {
  margin: 1rem 0;
}
.slidev-layout table {
  width: 100%;
}
.slidev-layout tr {
  border-bottom: 1px solid rgba(45, 45, 45, 0.15);
}
.slidev-layout th {
  text-align: left;
  font-weight: 400;
}
.slidev-layout td,
.slidev-layout th {
  padding: 0.5rem 0.5rem 0.75rem;
}
.slidev-layout b,
.slidev-layout strong {
  font-weight: 600;
}
.slidev-layout h1 + p {
  margin-top: -0.5rem;
  margin-bottom: 1rem;
  opacity: 0.5;
}
.slidev-layout p + h2,
.slidev-layout ul + h2,
.slidev-layout table + h2 {
  margin-top: 2.5rem;
}
.slidev-layout.cover {
  width: 100%;
  min-height: 720px;
  display: flex;
  align-items: stretch;
}
.slidev-layout.cover h1 {
  font-size: 3.75rem;
  line-height: 5rem;
}
.slidev-layout.cover > div {
  width: 100%;
  min-height: 720px;
}
.slidev-layout.two-columns {
  width: 100%;
  min-height: 720px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-content: start;
}
.slidev-layout.two-columns .two-cols-header {
  grid-column: 1 / -1;
  min-width: 0;
}
.slidev-layout.two-columns .col-left,
.slidev-layout.two-columns .col-right {
  min-width: 0;
}
.slidev-layout.two-columns .col-left {
  grid-column: 1;
}
.slidev-layout.two-columns .col-right {
  grid-column: 2;
}
.empty-state {
  display: flex;
  min-height: 100%;
  align-items: center;
  justify-content: center;
  color: #777;
  font-size: 1.25rem;
}
@media (max-width: 1320px) {
  .presentation {
    padding: 16px;
  }
  .slide-page {
    width: 100%;
    min-height: auto;
  }
}
`;

export const APP_CSS = `
body.markos-shell {
  min-height: 100vh;
  background: #000;
}
.app-frame {
  min-height: 100vh;
  padding: 20px;
}
.app-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin: 0 auto 16px;
  width: min(1320px, 100%);
  padding: 14px 18px;
  border: 1px solid rgba(45, 45, 45, 0.08);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.8);
  box-shadow: 0 18px 48px rgba(45, 45, 45, 0.08);
  backdrop-filter: blur(18px);
}
.app-brand {
  display: flex;
  align-items: center;
  gap: 12px;
}
.app-logo {
  width: 28px;
  height: 28px;
  flex: 0 0 auto;
}
.app-brand-copy {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.app-brand-copy strong {
  font-size: 0.95rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.app-brand-copy span,
.app-status,
.app-link {
  color: #666;
  font-size: 0.95rem;
}
.app-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.app-button,
.app-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 40px;
  padding: 0 14px;
  border: 1px solid rgba(45, 45, 45, 0.12);
  border-radius: 999px;
  background: #fff;
  text-decoration: none;
  transition: transform 120ms ease, border-color 120ms ease, box-shadow 120ms ease;
}
.app-button {
  cursor: pointer;
  font: inherit;
}
.app-button:hover,
.app-link:hover {
  transform: translateY(-1px);
  border-color: rgba(255, 138, 101, 0.45);
  box-shadow: 0 8px 18px rgba(45, 45, 45, 0.08);
}
.viewer-stage {
  display: flex;
  align-items: center;
  justify-content: center;
  width: min(1320px, 100%);
  margin: 0 auto;
  min-height: calc(100vh - 128px);
}
.viewer-stage.is-plain {
  width: 100%;
  min-height: 100vh;
  min-height: 100dvh;
  margin: 0;
  padding: 0;
}
.viewer-root {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100vw;
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
}
.viewer-canvas {
  flex: none;
  transform-origin: center center;
  will-change: transform;
}
.viewer-canvas > .slide-page.is-live {
  width: 100%;
  height: 100%;
  min-height: 0;
  margin: 0;
  box-shadow: none;
  page-break-after: auto;
}
.viewer-canvas > .slide-page.is-live > .slidev-layout,
.viewer-canvas > .slide-page.is-live > .slidev-layout.cover > div {
  width: 100%;
  height: 100%;
  min-height: 100%;
}
.viewer-canvas > .slide-page.is-live > .slidev-layout.default,
.viewer-canvas > .slide-page.is-live > .slidev-layout.cover,
.viewer-canvas > .slide-page.is-live > .slidev-layout.two-columns {
  min-height: 100%;
}
.viewer-stage .slide-page {
  box-shadow: 0 30px 90px rgba(45, 45, 45, 0.16);
}
.overview-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 18px;
  width: min(1320px, 100%);
  margin: 0 auto;
}
.overview-card {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px;
  border: 1px solid rgba(45, 45, 45, 0.08);
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.88);
  box-shadow: 0 16px 42px rgba(45, 45, 45, 0.08);
  text-decoration: none;
}
.overview-card.is-active {
  border-color: rgba(255, 138, 101, 0.85);
  box-shadow: 0 20px 54px rgba(255, 138, 101, 0.16);
}
.overview-meta {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}
.overview-index {
  color: #ff8a65;
  font-size: 0.88rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.overview-title {
  color: #2d2d2d;
  font-size: 0.96rem;
  font-weight: 600;
  text-align: right;
}
.overview-preview {
  overflow: hidden;
  border-radius: 14px;
  background: #ece9e4;
}
.overview-preview .slide-page {
  transform: scale(0.21);
  transform-origin: top left;
  margin-bottom: -568px;
}
.presenter-grid {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(0, 1.25fr);
  gap: 18px;
  width: min(1480px, 100%);
  margin: 0 auto;
}
.presenter-panel,
.presenter-sidebar {
  border: 1px solid rgba(45, 45, 45, 0.08);
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.88);
  box-shadow: 0 16px 42px rgba(45, 45, 45, 0.08);
  padding: 16px;
}
.presenter-stack {
  display: grid;
  gap: 16px;
}
.presenter-shell .slide-page {
  width: 100%;
  min-height: 0;
  aspect-ratio: 16 / 9;
  height: auto;
}
.presenter-sidebar h2 {
  margin: 0 0 8px;
  font-size: 1.1rem;
}
.presenter-sidebar p {
  margin: 0 0 12px;
  line-height: 1.6;
  color: #666;
}
.presenter-kbd {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 30px;
  height: 30px;
  padding: 0 8px;
  border: 1px solid rgba(45, 45, 45, 0.12);
  border-radius: 8px;
  background: #fff;
  font-size: 0.85rem;
  font-weight: 600;
}
@media (max-width: 1360px) {
  .viewer-stage .slide-page {
    width: 100%;
    min-height: auto;
    aspect-ratio: 16 / 9;
    height: auto;
  }
  .overview-preview .slide-page {
    width: 1280px;
    min-height: 720px;
  }
}
@media (max-width: 980px) {
  .app-topbar,
  .app-actions {
    align-items: stretch;
  }
  .app-topbar {
    flex-direction: column;
  }
  .presenter-grid {
    grid-template-columns: 1fr;
  }
}
`;
