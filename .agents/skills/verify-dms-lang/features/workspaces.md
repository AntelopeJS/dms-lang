---
covers:
  - src/utils/workspaces.ts
  - src/utils/catalog.ts
  - src/utils/tree.ts
  - src/utils/write-target.ts
  - src/utils/own.ts
  - src/validation/workspace.schema.ts
  - src/validation/validate.ts
  - src/validation/query.schema.ts
  - src/pages/workspaces.ts
  - src/pages/workspace-guard.ts
docs:
  - docs/1.introduction.md
  - docs/3.configuration.md
  - docs/4.usage/4.workspaces.md
  - docs/6.faq.md
---

# Workspaces

A workspace is one set of translation files. Besides the project files (`default`) and the installed modules (`modules`), a person creates workspaces for their other apps; each lives in `<workspacesDir>/<workspace>/` with one `<locale>.json` per language and is served publicly.

## Sub-features

- `create-and-list`: `POST /workspace` creates it with a base language, a description and a type; `GET /workspaces` lists the project files first, the created ones, the modules last, with the public URL template of the created ones only; the folder holds `.workspace.json` and `en.json`; a null description and an empty type clear the details; an unknown type is a 400.
- `name-rules`: error path: spaces, slashes, `..` and non-ASCII letters are 400 `invalid_workspace_id`, `default` and `modules` are 400 `reserved_workspace`, capitals are folded to lowercase, a taken name in any case is 409, an empty base language is 400.
- `rename-moves-the-public-url`: the files and the public URL move, the old URL answers 404, a taken, reserved or unknown name is refused.
- `delete-removes-everything`: Data containment: deleting removes the files, the list entry and the public URL, leaves another workspace and the project files untouched, and deleting again is a 404.
- `stored-files-stay-readable`: Format containment: a folder written by hand in the stored layout (`en.json`, `fr.json`, `.workspace.json`, tab-indented) is listed, counted and served, the module writes back the same layout, and a language file it creates starts as `{}` and is tab-indented with a final newline.
- `types-accepted`: the types dms, website, mobile and other are accepted and another is 400.
- `dialog-checks-the-name-live`: the New workspace dialog names a taken workspace, gives the naming rule for a reserved or malformed name and announces a free one as available.

## How to get to it (user POV)

- Workspaces page > New workspace, or `POST /api/lang/translations/workspace`.

## Driving it with dms-control

```bash
dms-control journey "$RUN" workspaces
```

## Gotchas

- The run stores workspaces under its own `HOME` (`workspacesDir` of the verification playground); ids are unique per journey.
- A typed capital is folded to lowercase, as the FAQ says ids are case-insensitive.
