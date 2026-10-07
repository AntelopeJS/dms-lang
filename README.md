# @antelopejs/dms-lang

<div align="center">
<a href="./LICENSE"><img alt="License" src="https://img.shields.io/badge/license-Apache--2.0-blue?style=for-the-badge&labelColor=000000"></a>
<a href="https://discord.gg/sjK28QHrA7"><img src="https://img.shields.io/badge/Discord-18181B?logo=discord&style=for-the-badge&color=000000" alt="Discord"></a>
<a href="https://antelopejs.com"><img src="https://img.shields.io/badge/Docs-18181B?style=for-the-badge&color=000000" alt="Documentation"></a>
</div>

Language and translation management for AntelopeJS DMS, available under `/modules/lang`.

It provides, under two sidebar groups:

- **Translate › Overview**: the coverage of each language of the selected workspace, a namespace × language heatmap and the public locale endpoint.
- **Translate › Translations**: a key-by-language matrix with per-cell save state, placeholder checks, "Missing in" and namespace filters, a key editor drawer and CSV export.
- **Language** (opened from Overview): a translation queue for one language, with its progress by namespace.
- **Manage › Workspaces**: every workspace with its kind, size and coverage, and the creation of new ones.
- **Workspace settings** (opened from Workspaces): name, base language, languages, ready-to-paste app snippets and a danger zone.

Every page names the workspace it works on in a scope bar, which also switches it; the selection is kept in the page URL (`?workspace=`). The command palette offers Translate missing keys, Add a translation key, Add a language and New translation workspace.

Write routes check the permission of the page action they belong to (`modules.lang.translate.translations.matrix.edit`, `….keys`, `modules.lang.manage.workspaces.list.create`, …); module pages stay owner-only, as every DMS module.

## Installation

Add the module to a project that already uses `@antelopejs/dms`:

```bash
ajs project modules add @antelopejs/dms-lang
```

## Configuration

Workspace mutations are disabled by default. Enable them explicitly in `antelope.config.ts` when
the running process should be allowed to create, rename, and delete workspaces, locales, keys, and
translations:

```typescript
config: {
  editable: true,
}
```

Added workspaces are stored in the module's `i18n-workspaces` directory. The module also registers
its bundled locale source and registry as a DMS frontend module.

## Development

```bash
pnpm install
pnpm build
pnpm test
```

## Vue and Inertia development

The backend registers `frontend-vue/dms.frontend.ts` through `AddFrontendModule` with the Vue 3 renderer. The module declares `componentPrefix: "DmsLang"` and registers every component of `app/components` and `app/build/components` under it; the backend pages name them (`CustomComponent("DmsLangTranslationMatrix")`). `dms.frontend.build.ts` declares `app/composables`, `app/utils` and `app/types` for auto-import; `app/build/` is private and imported by path. Nuxt is not required; `@nuxt/ui` provides its Vue components through the adapter's Vite integration.

The module compiles against the published `@antelopejs/interface-dms` package, its only DMS runtime dependency. The `@antelopejs/dms` backend and the `@antelopejs/dms-frontend` adapter are development dependencies, needed to run the tests and the playground. Run `pnpm install`, `pnpm build` and `pnpm test` here.

`pnpm test:unit` checks locale discovery and the coverage, placeholder and fallback helpers of the frontend. `pnpm test:frontend` compiles the module alongside the published core DMS frontend with the adapter's source verifier.

Run `pnpm dev` for the backend and `pnpm frontend:dev` for the Inertia workspace. The playground connects to MongoDB at `mongodb://localhost:27017`; set `MONGO_URL` to use another instance. The frontend workspace uses the `ajs dms` commands for development, preparation and production builds. Use `pnpm typecheck` for the backend; run `pnpm typecheck` in the generated Vite workspace for frontend types. The adapter owns the generated aliases, auto-import declarations and Vue compiler configuration.

## Locale sources no longer require a frontend build

At module startup, Lang obtains the registered frontend sources through `GetFrontendModules()`, after backend construction completes. Each translation read discovers JSON files under `i18n/locales`, including the DMS's nested `layers/*` directories. Files follow the adapter convention, such as `app-en-GB.json` and `lang-fr-FR.json`. Changes to files appear on subsequent reads; registering another frontend module requires restarting the backend.

Module translations remain external and read-only. An application's frontend registration marks its own writable translations with `options: { dmsI18nAppLayer: true }`, replacing the same flag in its old Nuxt configuration. The playground demonstrates this registration. Editing also requires the existing Lang `editable: true` setting. No locale path list or generated registry file is required.
