---
covers:
  - src/utils/summary.ts
  - src/utils/coverage.ts
  - src/pages/module.ts
docs:
  - docs/4.usage/2.translation-matrix.md
  - docs/6.faq.md
  - docs/1.introduction.md
  - docs/2.installation.md
  - docs/5.extending.md
---

# Module texts

The Installed modules workspace (`modules`) lists the texts the DMS and its modules ship, read-only. A person changes one by writing the same key in the project files, which overrides it without touching the module.

## Sub-features

- `modules-workspace-is-read-only`: the key `dms.button.save_changes` is listed in English and French, not overridden; update, create, delete and add a language are refused, the first three as 403 `read_only`.
- `override-a-module-text`: a French write on the key lands in `app-fr-FR.json` only, the row keeps the module's texts as `inherited`, the modules workspace flags the key as overridden, the project's overrides count goes 0 to 1 and its missing count does not grow; dropping the override removes it from the file and the key can not be deleted as a project key.
- `a-module-registered-after-start-appears`: the playground registers a second frontend module while the backend runs (`verify-frontend-modules.txt`, see SKILL.md); its `late.hello` shows in the installed modules without a restart, not in the project files.

## How to get to it (user POV)

- Translation matrix > Installed modules > a key > Override.

## Driving it with dms-control

```bash
dms-control journey "$RUN" module-texts
```

## Gotchas

- The journeys put the shipped project files back before they start.
