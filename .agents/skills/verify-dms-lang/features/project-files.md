---
covers:
  - src/utils/locale-discovery.ts
  - src/utils/registry.ts
  - src/utils/write-target.ts
  - src/utils/cache.ts
  - src/utils/resolve.ts
  - src/utils/own.ts
  - src/utils/guards.ts
  - src/frontend-module.ts
docs:
  - docs/2.installation.md
  - docs/3.configuration.md
  - docs/6.faq.md
---

# Project files

The Project files workspace (`default`) edits the `<name>-<xx-XX>.json` files of the frontend module flagged `dmsI18nAppLayer`. The verification playground flags its own module, and the journeys rewrite its locale folder in the run's copy.

## Sub-features

- `discovery-by-file-name`: files named `<name>-<xx-XX>.json` count, subfolders too; `app-it.json`, `en.json` and a `.txt` are ignored; `en-GB` and `en-US` merge into `en`; a removed or edited file shows on the next read.
- `layers-replace-the-root-folder`: with a `layers` folder only `layers/*/i18n/locales` is scanned, even when empty; removing it brings the root folder back. The layout is read at start, so each step restarts the backend.
- `later-file-wins`: two files define one key, the later file name wins and the key has one row.
- `writes-follow-the-defining-file`: the four write-routing rules of the configuration page, in order: the defining file, the file with the longest part of the namespace, the last exactly named `app-<xx-XX>.json` (not a domain file such as `app-zeta-fr-FR.json`), the last file of the language.
- `delete-uncovers-the-older-definition`: with two files defining a key, a delete, a clear and a rename change only the winning definition, and the older text shows again.
- `rename-stays-in-the-defining-file`: a key renamed into another namespace stays in the file that defined it.
- `dropping-an-override-removes-only-the-winning-one`: dropping an override of a module key removes the newest project definition and the older one shows again.
- `no-workspace-query-defaults-to-the-project-files`: a page opened without `?workspace=` by someone who never chose one shows the project files.
- `pages-arrive-rendered-by-the-server`: the HTML the frontend server sends, read without a browser, holds the matrix rows with their texts and the queue's first missing key; without `?workspace=` the server sends the workspace of the `dms-lang-workspace` cookie, else the project files.
- `reregistering-changes-the-origin`: the playground registers its module again without `dmsI18nAppLayer`: `shop.title` moves to the installed modules with no file change; flagged again, it is a project file again.
- `lower-priority-app-layer-merges-first`: a second flagged module of priority 0, registered while the backend runs, adds `late.hello` to the project files, and the app module (priority 1) keeps `shop.title`.

## How to get to it (user POV)

- Translation matrix on the Project files workspace; `PUT /api/lang/translations/key`.

## Driving it with dms-control

```bash
dms-control journey "$RUN" project-files
```

## Gotchas

- The journeys write into the run's copy of the playground (`<run>/root/.agents/skills/verify-dms-lang/playground/frontend-vue/i18n/locales`) and put the shipped files back at the end.
- A journey that fails halfway leaves its files; the next journey of the feature resets them first.
