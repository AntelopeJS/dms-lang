# @antelopejs/dms-lang

<div align="center">
<a href="./LICENSE"><img alt="License" src="https://img.shields.io/badge/license-Apache--2.0-blue?style=for-the-badge&labelColor=000000"></a>
<a href="https://discord.gg/sjK28QHrA7"><img src="https://img.shields.io/badge/Discord-18181B?logo=discord&style=for-the-badge&color=000000" alt="Discord"></a>
<a href="https://antelopejs.com"><img src="https://img.shields.io/badge/Docs-18181B?style=for-the-badge&color=000000" alt="Documentation"></a>
</div>

Language and translation management for the AntelopeJS DMS, available under `/modules/lang`: coverage at a glance, a translation matrix, a per-language translation queue, and translation workspaces served publicly to your other apps.

![The Lang overview](./docs/images/overview.png)

**Documentation: [dms.antelopejs.com/docs/modules/lang](https://dms.antelopejs.com/docs/modules/lang)** (sources in [`docs/`](./docs)).

## Installation

Add the module to a project that already uses `@antelopejs/dms`:

```bash
ajs project modules add @antelopejs/dms-lang
```

Writes are disabled by default; set `editable: true` in the module's `config` to allow them. See [Configuration](https://dms.antelopejs.com/docs/modules/lang/configuration).

## Claude Code skill

The package ships the `dms-lang` skill in [`skills/`](./skills), declared in `package.json` under `antelopeJs.skills`.

## Development

```bash
pnpm install
pnpm build
pnpm test
```

## Vue and Inertia development

The backend registers `frontend-vue/dms.frontend.ts` through `AddFrontendModule` with the Vue 3 renderer. The module declares `componentPrefix: "DmsLang"` and registers every component of `app/components` and `app/build/components` under it; the backend pages name them (`CustomComponent("DmsLangTranslationMatrix")`). `dms.frontend.build.ts` declares `app/composables`, `app/utils` and `app/types` for auto-import; `app/build/` is private and imported by path. Nuxt is not required; `@nuxt/ui` provides its Vue components through the adapter's Vite integration.

Its pages read the data they render with the DMS's `useApiData`, which a server render reads and hands to the browser with the page; the dialogs that ask the server for their wording read it when they open. The module requires `@antelopejs/dms` 0.9, `@antelopejs/interface-dms` 0.7 and `@antelopejs/dms-frontend` 0.6. The public language files (`/i18n/**`) are declared to the frontend server as a backend prefix without a session (`backendProxies`), so the DMS's own origin serves them. It compiles against the published `@antelopejs/interface-dms` package, its only DMS runtime dependency. The `@antelopejs/dms` backend and the `@antelopejs/dms-frontend` adapter are development dependencies, needed to run the tests and the playground. Run `pnpm install`, `pnpm build` and `pnpm test` here.

`pnpm test:unit` checks locale discovery, the coverage, placeholder and message helpers of the frontend and the locale files, and renders the workspace composables on a server with the installed adapter and `useApiData` (`tests/frontend-runtime.mjs`). The backend tests (`src/test`: keys, workspaces, validation, coverage, summaries) run with `pnpm test` only: every backend file reaches an AntelopeJS interface (`@antelopejs/interface-api` for the errors, `@antelopejs/interface-dms` for the pages), and an interface refuses to load outside the AntelopeJS runtime. `pnpm test:frontend` compiles the module alongside the published core DMS frontend with the adapter's source verifier.

Run `pnpm dev` for the backend and `pnpm frontend:dev` for the Inertia workspace. The playground connects to MongoDB at `mongodb://localhost:27017`; set `MONGO_URL` to use another instance. The frontend workspace uses the `ajs dms` commands for development, preparation and production builds. Use `pnpm typecheck` for the backend; run `pnpm typecheck` in the generated Vite workspace for frontend types. The adapter owns the generated aliases, auto-import declarations and Vue compiler configuration.
