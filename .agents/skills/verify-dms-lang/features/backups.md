---
covers:
  - src/utils/export.ts
  - src/utils/json.ts
  - frontend-vue/app/utils/workspaceBackup.ts
  - frontend-vue/app/utils/download.ts
docs:
  - docs/4.usage/4.workspaces.md
  - docs/4.usage/5.workspace-settings.md
  - docs/5.extending.md
---

# Backups

Download backup saves every language of a workspace as one JSON file; Import creates a workspace from such a file. Export hands out one language or all of them.

## Sub-features

- `backup-restores-the-workspace`: the backup carries `format: "dms-lang.workspace"`, `version: 1`, the id, the base language, the languages, the details and one tree per language; deleting the workspace and importing the backup brings back the same keys, files and public URL; a copy under another name holds the same texts.
- `backup-refusals`: error path: a taken name is 409, a reserved name, another format, a newer version, a non-string text, a message vue-i18n cannot compile and texts of an undeclared language are 400, and none of them creates a workspace.
- `export-one-language-or-all`: `GET /export?locale=fr` is that language's tree, without `locale` every language, an unknown language is 404.
- `empty-workspace-roundtrip`: a workspace without keys exports empty trees for every language, backs up, and restores with its languages; a backup with only an id and messages imports.

## How to get to it (user POV)

- Workspace settings > Danger zone > Download backup; Workspaces > Import.

## Driving it with dms-control

```bash
dms-control journey "$RUN" backups
```

## Gotchas

- The import checks messages the way a key write does, so an `@` that is not written `{'@'}` is refused.
