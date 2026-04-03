# @tinycircl/markos-slides-core

`@tinycircl/markos-slides-core` is the reusable build core behind MarkOS.

It is responsible for:
- normalizing slide sources
- building static web slide sites
- exposing the built-in `markos-web` render engine
- powering both local authoring and server-side rendering flows

## Requirements

- Node.js `>=22`

## Install

```bash
npm install @tinycircl/markos-slides-core
```

## Example

```js
import {buildStaticSiteFromInput} from "@tinycircl/markos-slides-core";

await buildStaticSiteFromInput({
  input: {
    title: "Demo Deck",
    content: "# Hello MarkOS",
  },
  outputDir: "./dist",
  workDir: "./.markos-work/dist",
  basePath: "/",
});
```

For CLI-style local authoring, the recommended repository layout is `slides.md` plus `slides.css` as the main override layer, with optional `agent-overrides.css` for a final incremental override layer.

## Public Exports

- `@tinycircl/markos-slides-core`
- `@tinycircl/markos-slides-core/config`
- `@tinycircl/markos-slides-core/path-utils`
- `@tinycircl/markos-slides-core/engines`
- `@tinycircl/markos-slides-core/engines/markos-web`
- `@tinycircl/markos-slides-core/dev-server`
- `@tinycircl/markos-slides-core/manifest-site`
- `@tinycircl/markos-slides-core/artifact-store`

## Notes

This package currently supports web output only.
