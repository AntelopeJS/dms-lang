# @antelopejs/dms-lang

<div align="center">
<a href="./LICENSE"><img alt="License" src="https://img.shields.io/badge/license-Apache--2.0-blue?style=for-the-badge&labelColor=000000"></a>
<a href="https://discord.gg/sjK28QHrA7"><img src="https://img.shields.io/badge/Discord-18181B?logo=discord&style=for-the-badge&color=000000" alt="Discord"></a>
<a href="https://antelopejs.com"><img src="https://img.shields.io/badge/Docs-18181B?style=for-the-badge&color=000000" alt="Documentation"></a>
</div>

Language and translation management for AntelopeJS DMS, available under `/modules/lang`.

It provides:

- **Overview** — workspace and locale summaries, translation coverage, and the public locale endpoint.
- **Translations** — a key-by-locale matrix with missing-translation filtering.
- **Workspace selection** — a global sidebar widget for switching workspaces.

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

The backend registers `frontend-vue/dms.frontend.ts` through `AddFrontendModule` with the Vue 3 renderer. It exposes `DmsLang*` component names, pages and the sidebar widget. Nuxt is not required; `@nuxt/ui` provides its Vue components through the adapter's Vite integration.

The module compiles against the published `@antelopejs/interface-dms` package, its only DMS runtime dependency. The `@antelopejs/dms` backend and the `@antelopejs/dms-frontend` adapter are development dependencies, needed to run the tests and the playground. Run `pnpm install`, `pnpm build` and `pnpm test` here.

`pnpm test:unit` checks locale discovery and fallback normalization. `pnpm test:frontend` compiles the module alongside the published core DMS frontend with the adapter's source verifier.

Run `pnpm dev` for the backend and `pnpm frontend:dev` for the Inertia workspace. Use `pnpm typecheck` for the backend; run `pnpm typecheck` in the generated Vite workspace for frontend types. The adapter owns the generated aliases, auto-import declarations and Vue compiler configuration.

## Locale sources no longer require a frontend build

At module startup, Lang obtains the registered frontend sources through `GetFrontendModules()`, after backend construction completes. Each translation read discovers JSON files under `i18n/locales`, including the DMS's nested `layers/*` directories. Files follow the adapter convention, such as `app-en-GB.json` and `lang-fr-FR.json`. Changes to files appear on subsequent reads; registering another frontend module requires restarting the backend.

Module translations remain external and read-only. An application's frontend registration marks its own writable translations with `options: { dmsI18nAppLayer: true }`, replacing the same flag in its old Nuxt configuration. The playground demonstrates this registration. Editing also requires the existing Lang `editable: true` setting. No locale path list or generated registry file is required.
