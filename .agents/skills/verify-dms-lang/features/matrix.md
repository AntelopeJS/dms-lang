---
covers:
  - src/pages/translations.ts
  - src/pages/quick-actions.ts
  - src/pages/header-actions.ts
  - src/pages/workspace.ts
  - src/utils/namespaces.ts
  - frontend-vue/app/components/TranslationMatrix.vue
  - frontend-vue/app/build/components/matrix/**
  - frontend-vue/app/build/matrix/**
  - frontend-vue/app/build/drawer/**
  - frontend-vue/app/build/components/KeyEditorDrawer.vue
  - frontend-vue/app/build/components/KeyStatus.vue
  - frontend-vue/app/build/composables/useCell*.ts
  - frontend-vue/app/build/composables/useKey*.ts
  - frontend-vue/app/build/composables/useMatrix*.ts
  - frontend-vue/app/utils/matrixExport.ts
  - frontend-vue/app/utils/keySaves.ts
  - frontend-vue/app/utils/translations.ts
  - frontend-vue/app/utils/boundedCache.ts
  - frontend-vue/app/config/shortcuts-registry.ts
  - frontend-vue/app/utils/shortcuts.ts
  - frontend-vue/app/build/components/ShortcutKbds.vue
docs:
  - docs/4.usage/2.translation-matrix.md
  - docs/1.introduction.md
---

# Translation matrix

Every key of the workspace as a row, every language as a column, with inline editing, status tabs, a key panel, add and delete with undo, and export.

## Sub-features

- `edit-a-cell-saves-and-moves-on`: a click edits a cell, Enter saves it and opens the next row's cell, Escape cancels without writing.
- `status-tabs-search-and-namespace`: the tabs count All, Missing, Complete and Issues; each narrows the rows; the search matches texts as well as paths; `?filter=missing` opens the incomplete keys.
- `key-panel-edits-every-language`: the panel for `shop.pay` shows its position, its variables and one field per language, Save writes both, and `?key=` reopens it after a reload.
- `add-key-dialog`: the dialog needs the path and a text, cannot be submitted empty, Add another keeps it open, and the keys land in the base file and in French.
- `delete-key-offers-undo`: Delete asks first, removes the key from every language, and Undo restores it.
- `export-menu-counts-the-view`: Export lists "This view" and "Everything" with their key and language counts.
- `override-a-module-key-from-the-matrix`: Installed modules > a key > Override opens it in the project files, where saving a French text writes the override.
- `language-and-namespace-filters`: `missingIn=` keeps the rows missing in one language and `namespace=` restricts the rows to one namespace.
- `key-panel-renames-and-closing-saves`: closing the key panel saves the language that changed, and Rename gives the key its new path with both texts.

## How to get to it (user POV)

- Modules > Translations > Translate > Translation matrix.

## Driving it with dms-control

```bash
dms-control journey "$RUN" matrix
```

## Gotchas

- The download of the CSV is built in the browser; the journeys check the menu entries and leave the file to the unit tests.
- A cell that is saved and a Escape that cancels are told apart by what the API holds afterwards.
