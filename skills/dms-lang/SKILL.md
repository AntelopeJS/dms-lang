---
name: dms-lang
description: Manages translations with the @antelopejs/dms-lang module of the AntelopeJS DMS. Use when installing or configuring dms-lang, adding or translating i18n keys of a DMS project (app-*.json), overriding a module's texts, creating a translation workspace served as public JSON to another app (website, mobile), or debugging read-only, missing or 404 translations.
icon: i-lucide-languages
category: i18n
tags: [i18n, translations, locales, workspaces, dms-module]
---

# dms-lang

Translation management for the DMS, under `/modules/lang` (owner-only, like every module page).
User docs: `docs/` of this package, published at https://dms.antelopejs.com/docs/modules/lang.

## When to reach for it

- A project needs its dashboard texts (`$app.*` keys) translated or edited without touching JSON by hand.
- Another app (website, mobile app) needs translation files hosted and edited in the DMS.
- A module's built-in text must read differently in one project: override the key, never edit the module's files.

## Setup

```bash
ajs project modules add @antelopejs/dms-lang
```

- `config.editable: true` in `antelope.config.ts` allows every write. Default `false`: writes fail with a read-only error.
- The project's own frontend module needs `options: { dmsI18nAppLayer: true }` in `AddFrontendModule`; its `i18n/locales/app-<locale>.json` files become the writable **Project files** workspace.
- A new frontend module is discovered at backend start only; file edits show on the next read.
- Lang 0.2 requires `@antelopejs/dms` >=0.9 (interface-dms 0.7, renderer `@antelopejs/dms-frontend` 0.6); Lang 0.1 is the DMS 0.8 line.

## Workspaces

| Id | Kind | Editable | Public |
| --- | --- | --- | --- |
| `default` | Project files (`app-*.json`) | yes, with `editable` | no |
| `modules` | Files shipped by the DMS and installed modules | no, override into `default` | no |
| any other | Created in the UI or by `POST /api/lang/translations/workspace` / `import` | yes, with `editable` | `GET <apiBaseUrl>/i18n/<id>/<locale>.json`, any origin |

Created workspaces live in the module's `i18n-workspaces/<id>/` folder: back them up (Download backup) before reinstalling.

## Pages and links

Overview, Translation matrix (`translations`), Translation queue (`language?locale=`), Workspaces, Workspace settings (`workspace`). Every page takes `?workspace=<id>`; `?action=add-key|add-language|new-workspace` opens the dialog, `?filter=missing` filters the matrix.

## Gotchas

- Messages use the vue-i18n format: `{name}` placeholders, `one | many` plurals, a literal `@` written `{'@'}`. A placeholder that differs from the base text is flagged as an issue.
- In `default`, a key a module already translates counts as translated ("From a module"); writing a value overrides it.
- Write routes check page-action permissions (`modules.lang.translate.translations.scoped.matrix.edit`, `….keys`, `modules.lang.manage.workspaces.list.create`, …) on top of `@AuthOwnerOnly`.
- Writes publish on the realtime topic `dms-lang.translations`.
- Pages render on the server (`useApiData`); a page without `?workspace=` is redirected server-side to the remembered workspace or `default`.
- The public files are declared to the frontend server (`backendProxies: [{ path: "/i18n/**", auth: "none" }]`), so they answer on the dashboard origin as well as the backend's.
- Labels of a page or custom block you write stay i18n keys (`$app.my_page.title`) in `app-*.json`; Lang is where people translate them, never a reason to hard-code text.
