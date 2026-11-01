<div align="center">

# @antelopejs/dms-lang

<a href="https://www.npmjs.com/package/@antelopejs/dms-lang"><img alt="npm" src="https://img.shields.io/npm/v/@antelopejs/dms-lang?style=for-the-badge&labelColor=000000&color=000000"></a>
<a href="./LICENSE"><img alt="License" src="https://img.shields.io/npm/l/@antelopejs/dms-lang?style=for-the-badge&labelColor=000000&color=000000"></a>
<a href="https://discord.gg/g4pFt6eXqu"><img alt="Discord" src="https://img.shields.io/badge/Discord-18181B?logo=discord&style=for-the-badge&color=000000"></a>
<a href="https://dms.antelopejs.com/docs/modules/lang"><img alt="Documentation" src="https://img.shields.io/badge/Docs-18181B?style=for-the-badge&color=000000"></a>

Language and translation management for the [AntelopeJS DMS](https://github.com/AntelopeJS/dms).

</div>

![The Lang overview: coverage KPIs, languages ranked by coverage and a namespace heatmap](./docs/images/overview.png)

## What it does

- Reads every locale file the dashboard loads and shows how complete each language is, with a namespace × language heatmap.
- Edits every key side by side in a translation matrix, with placeholder checks, filters and CSV export.
- Walks one language key by key in a translation queue, with the base text and the other languages for context.
- Hosts translation workspaces for your other apps and serves them as public JSON at `/i18n/<workspace>/<locale>.json`.

## Install

Run the AntelopeJS CLI from the root of a project that already loads `@antelopejs/dms`:

```bash
ajs project modules add @antelopejs/dms-lang
```

## Quick start

The module starts read-only. Allow writes on the process that edits translations:

```ts
// antelope.config.ts
"dms-lang": {
  source: { type: "package", package: "@antelopejs/dms-lang", version: "^0.2.0" },
  config: {
    editable: true,
  },
},
```

Restart the backend, then the frontend, and open **Modules › Translations** (`/modules/lang/overview`). To edit your own frontend module's locale files, register it with `options: { dmsI18nAppLayer: true }`: see [Installation](https://dms.antelopejs.com/docs/modules/lang/installation).

## Requirements

<!-- antelopejs-docs-compat:start -->

| Package                          | Supported         | Tested with |
| -------------------------------- | ----------------- | ----------- |
| `@antelopejs/interface-api`      | `>=0.0.15 <1.0.0` | `0.0.15`    |
| `@antelopejs/interface-api-util` | `>=0.1.3 <1.0.0`  | `0.1.3`     |
| `@antelopejs/interface-core`     | `>=0.2.4 <1.0.0`  | `0.2.4`     |
| `@antelopejs/interface-dms`      | `>=0.9.0 <1.0.0`  | `0.9.0`     |

<!-- antelopejs-docs-compat:end -->

| Package | Version |
| --- | --- |
| `@antelopejs/dms` | `>=0.13.1 <1.0.0` |
| `@antelopejs/interface-dms` | `>=0.9.0 <1.0.0` |
| `@antelopejs/dms-frontend` (renderer) | `>=0.9.2 <0.10.0` |

## Documentation

- [Introduction](https://dms.antelopejs.com/docs/modules/lang/introduction)
- [Installation](https://dms.antelopejs.com/docs/modules/lang/installation)
- [Configuration](https://dms.antelopejs.com/docs/modules/lang/configuration)
- [Usage](https://dms.antelopejs.com/docs/modules/lang/usage/overview)
- [Extending](https://dms.antelopejs.com/docs/modules/lang/extending)
- [FAQ](https://dms.antelopejs.com/docs/modules/lang/faq)

The canonical guide lives in [`docs/`](./docs), including the [supported extension boundary](./docs/5.extending.md#supported-extension-boundary). There is no separate DMS Lang interface package. The package also ships the `dms-lang` Claude Code skill in [`skills/`](./skills), declared under `antelopeJs.skills`.

## Contributing

Read [CONTRIBUTING.md](./CONTRIBUTING.md) before opening a pull request. The playground connects to MongoDB at `mongodb://localhost:27017`; set `MONGO_URL` to use another instance.

```bash
pnpm install
pnpm dev            # playground backend
pnpm frontend:dev   # dashboard, in a second terminal
pnpm lint
pnpm typecheck
pnpm test
```

<details>
<summary>Repository notes</summary>

- The backend registers `frontend-vue/dms.frontend.ts` through `AddFrontendModule` with the Vue 3 renderer, under the `DmsLang` component prefix: every component of `app/components` and `app/build/components` is registered under it, and the backend pages name them (`CustomComponent("DmsLangTranslationMatrix")`). `dms.frontend.build.ts` auto-imports `app/composables`, `app/utils` and `app/types`; `app/build/` is private and imported by path.
- The pages read their data with the DMS's `useApiData`, which the server render hands to the browser with the page. The public language files (`/i18n/**`) are declared to the frontend server as a backend prefix without a session (`backendProxies`).
- The module compiles against the published `@antelopejs/interface-dms`; `@antelopejs/dms` and `@antelopejs/dms-frontend` are development dependencies, needed by the tests and the playground.
- `pnpm test:unit` checks locale discovery, the coverage, placeholder and message helpers, and renders the workspace composables on a server (`tests/frontend-runtime.mjs`). The backend tests (`src/test`) run with `pnpm test` only, since an interface refuses to load outside the AntelopeJS runtime. `pnpm test:frontend` compiles the module against the published DMS frontend with the renderer's source verifier.

</details>

## License

[Apache-2.0](./LICENSE)
