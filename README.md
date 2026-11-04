<div align="center">

# `@antelopejs/dms-lang`

<a href="https://www.npmjs.com/package/@antelopejs/dms-lang"><img alt="npm" src="https://img.shields.io/npm/v/@antelopejs/dms-lang?style=for-the-badge&labelColor=000000&color=000000" data-illustration></a>
<a href="./LICENSE"><img alt="License" src="https://img.shields.io/npm/l/@antelopejs/dms-lang?style=for-the-badge&labelColor=000000&color=000000" data-illustration></a>
<a href="https://discord.gg/g4pFt6eXqu"><img alt="Discord" src="https://img.shields.io/badge/Discord-18181B?logo=discord&style=for-the-badge&color=000000" data-illustration></a>
<a href="https://dms.antelopejs.com/docs/modules/lang"><img alt="Documentation" src="https://img.shields.io/badge/Docs-18181B?style=for-the-badge&color=000000" data-illustration></a>

Language and translation management for the [AntelopeJS DMS](https://github.com/AntelopeJS/dms).

</div>

![The Lang overview of the customer-portal workspace: coverage figures, languages ranked by coverage and a namespace heatmap](./docs/images/captures/lang-overview.webp)

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

The command adds an `@antelopejs/dms-lang` entry to `antelope.config.ts`. The module starts read-only. To allow writes on the process that edits translations, set `editable: true` in that entry:

```ts fragment
"@antelopejs/dms-lang": {
  source: { type: "package", package: "@antelopejs/dms-lang", version: "<latest>" },
  config: {
    editable: true,
  },
},
```

Restart the backend, then the frontend, and open **Modules › Translations** (`/modules/lang/overview`). To edit your own frontend module's locale files, register it with `options: { dmsI18nAppLayer: true }`, as [Installation](https://dms.antelopejs.com/docs/modules/lang/installation) shows.

## Requirements

<!-- antelopejs-docs-compat:start -->

| Package                          | Supported                                                 | Tested with                                               |
| -------------------------------- | --------------------------------------------------------- | --------------------------------------------------------- |
| `@antelopejs/interface-api`      | `>=0.2.0 <1.0.0`                                          | `0.2.0`                                                   |
| `@antelopejs/interface-api-util` | `>=0.3.0 <1.0.0`                                          | `0.3.0`                                                   |
| `@antelopejs/interface-core`     | `>=0.4.0 <1.0.0`                                          | `0.4.0`                                                   |
| `@antelopejs/interface-dms`      | `file:.campaign/tgz/antelopejs-interface-dms-14e671d.tgz` | `file:.campaign/tgz/antelopejs-interface-dms-14e671d.tgz` |

<!-- antelopejs-docs-compat:end -->

The module also needs a DMS backend in a release that implements the `@antelopejs/interface-dms` range above. It needs the `@antelopejs/dms-frontend` renderer in the range that `engines["@antelopejs/dms-frontend"]` of `frontend-vue/package.json` declares. The `ajs dms` CLI refuses to build the module with a renderer outside that range.

## Documentation

- [Introduction](https://dms.antelopejs.com/docs/modules/lang/introduction)
- [Installation](https://dms.antelopejs.com/docs/modules/lang/installation)
- [Configuration](https://dms.antelopejs.com/docs/modules/lang/configuration)
- [Usage](https://dms.antelopejs.com/docs/modules/lang/usage/overview)
- [Extending](https://dms.antelopejs.com/docs/modules/lang/extending)
- [FAQ](https://dms.antelopejs.com/docs/modules/lang/faq)

The canonical guide lives in [`docs/`](./docs), including the [supported extension boundary](./docs/5.extending.md#supported-extension-boundary). There is no separate DMS Lang interface package. The package also ships the `dms-lang` Claude Code skill in [`skills/`](./skills), declared under `antelopeJs.skills`.

## Contributing

Read [CONTRIBUTING.md](./CONTRIBUTING.md) before opening a pull request. The playground connects to MongoDB at `mongodb://localhost:27017`. To use another instance, set `MONGO_URL`.

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

- The backend registers the `frontend-vue` module through `AddFrontendModule` with the `vue` renderer. `frontend-vue/dms.frontend.ts` registers every component of `app/components` and `app/build/components` under the `DmsLang` component prefix, and the backend pages name them, as in `CustomComponent("DmsLangTranslationMatrix")`.
- `dms.frontend.build.ts` auto-imports `app/composables`, `app/utils` and `app/types`. The code in `app/build/` is private and imported by path.
- The pages read their data with the DMS's `useApiData`, which the server render hands to the browser with the page. The module declares the public language files (`/i18n/**`) to the frontend server as a backend prefix without a session (`backendProxies`).
- The module compiles against the published `@antelopejs/interface-dms`. `@antelopejs/dms` and `@antelopejs/dms-frontend` are development dependencies for the tests and the playground.
- `pnpm test:unit` runs the locale discovery and write target suites of `src/test` and the `node:test` suites in `tests`. The other `src/test` suites run with `pnpm test` only, since an interface refuses to load outside the AntelopeJS runtime. `pnpm test:frontend` checks `frontend-vue` against the installed DMS frontend layer with `ajs dms verify-source`.

</details>

## License

[Apache-2.0](./LICENSE)
