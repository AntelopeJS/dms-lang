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
- `status-tabs-search-and-namespace`: the tabs count All, Incomplete (named Missing when one language is counted), Complete and Issues; each narrows the rows; the search matches texts as well as paths; `?filter=missing` opens the incomplete keys.
- `key-panel-edits-every-language`: the panel for `shop.pay` shows its position, its variables and one field per language, Save writes both, and `?key=` reopens it after a reload.
- `add-key-dialog`: the dialog needs the path and a text, cannot be submitted empty, Add another keeps it open, and the keys land in the base file and in French.
- `delete-key-offers-undo`: Delete asks first, naming the translations it removes (`its 2 translations (en, fr)`), removes the key from every language, and Undo restores it.
- `export-menu-counts-the-view`: Export lists "This view" and "Everything" with their key and language counts.
- `override-a-module-key-from-the-matrix`: Installed modules > a key > Override opens it in the project files, where saving a French text writes the override, and the row then carries the Overridden badge in the installed modules.
- `language-and-namespace-filters`: `missingIn=` (the toolbar's language filter) keeps the rows missing in one language and `namespace=` restricts the rows to one namespace.
- `key-panel-renames-and-closing-saves`: closing the key panel saves the language that changed, and Rename gives the key its new path with both texts.
- `sidebar-badge-counts-the-project-files`: the sidebar lists Overview, Translation matrix and Translation queue under Translate, Workspaces and Workspace settings under Manage; the breadcrumb's Translations opens `/modules/lang/overview`; the matrix's badge counts the project files' one gap while another workspace is open, and goes once it is translated.
- `missing-in-and-the-language-columns`: each column header reads its missing count with a coverage meter; with every column shown the incomplete rows are those missing in any language; Languages hides German, and the language filter set to German still keeps the row German lacks.
- `groups-collapse-and-stay-as-they-were`: a namespace group collapses and opens again, and closing the key panel leaves a collapsed group collapsed.
- `cell-line-break-and-failed-save`: Shift Enter adds a line break without saving; a save the backend cannot write (the language file made read-only) says Not saved with Retry and keeps the text, and Retry saves it.
- `key-panel-moves-between-keys`: the header reads `2 of 3 · shop`; J and K, and the Next and Previous arrows, open the next and previous key; J typed in a field is text.
- `key-panel-inserts-a-token-and-saves-on-leave`: Insert {price} puts the missing placeholder in the field, and leaving the field saves it without Save.
- `key-panel-stays-open-on-a-failed-save`: Close with an unclosed brace keeps the panel open on the text and writes nothing; once valid, Close saves and closes; clearing the base text asks `Clear the base text of shop.title?` and clears nothing before it.

- `back-closes-the-panel`: with the key panel opened from the matrix, the browser's Back (`tab.page.goBack()`) closes it, drops `key=` and stays on the matrix. A run whose Back leaves the matrix is tried again from a fresh matrix, up to three times; a Back that never closes the panel fails every time.
- `width-is-kept-on-this-device`: the panel's grip (`separator "Resize the drawer"`) is resized with six presses of ArrowLeft, its width is read from `aria-valuenow`, and the reload opens the panel at the same width.

## How to get to it (user POV)

- Modules > Translations > Translate > Translation matrix.

## Driving it with dms-control

```bash
dms-control journey "$RUN" matrix
```

## Gotchas

- The download of the CSV is built in the browser; the journeys check the menu entries and leave the file to the unit tests.
- A cell that is saved and a Escape that cancels are told apart by what the API holds afterwards.
