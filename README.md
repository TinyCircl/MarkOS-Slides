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
