---
covers:
  - src/utils/snippets.ts
  - src/utils/public-url.ts
  - frontend-vue/app/components/WorkspaceList.vue
  - frontend-vue/app/components/WorkspaceGeneral.vue
  - frontend-vue/app/components/WorkspaceDangerZone.vue
  - frontend-vue/app/build/components/WorkspaceCreateModal.vue
  - frontend-vue/app/build/components/WorkspaceRenameModal.vue
  - frontend-vue/app/build/components/form/**
  - frontend-vue/app/utils/workspaces.ts
  - frontend-vue/app/utils/workspaceBackup.ts
  - frontend-vue/app/composables/translation/useWorkspaceActions.ts
  - frontend-vue/app/composables/translation/useWorkspaceNameCheck.ts
  - frontend-vue/app/utils/download.ts
docs:
  - docs/4.usage/4.workspaces.md
  - docs/4.usage/5.workspace-settings.md
---

# Workspaces page and workspace settings

The Workspaces page lists every set of translation files as a card and creates new ones; the settings of one workspace hold its details, its languages, the snippets to load it in an app and the danger zone.

## Sub-features

- `new-workspace-dialog`: `?action=new-workspace` opens the dialog on arrival, the button stays disabled without a name, the dialog previews the public URL, and Create stores the workspace with its description and type and lists it; its card shows the type, the description, the `GET` URL and a Copy button.
- `switch-the-current-workspace`: a page opened without `?workspace=` goes to the workspace used last, the scope bar's switcher moves every page, and the next page follows.
- `settings-save-as-you-go`: a description and a type typed on the settings page are stored without a Save button; the About card shows the kind, the folder and the figures.
- `snippets-for-your-app`: the Use in your app card gives the URL and one snippet each for vue-i18n, i18next, fetch and curl; the snippet route returns the same code; the vue-i18n setup loads the base, the language and the region variant and falls back to the base, the i18next one falls back from the region to the language, then to the base.
- `cards-show-the-figures`: a card reads `Languages 2 Keys 2 Coverage 50% Missing 1` with a chip per language, the project files' card counts Overrides and the installed modules' one Overridden; Settings on the project files' card opens their settings, and Switch makes them current.
- `add-language-picker`: Add language finds Italiano by its native name and adds `it`; `tlh-Latn`, a code the list does not know, is added as typed with its file.
- `rename-from-the-danger-zone`: Rename tells a taken name and a free one live, shows the URL before and after, the public URL moves and the old one answers 404.
- `delete-needs-the-name-typed`: Delete lists the files and strings it removes, offers a backup, ignores a wrong name and deletes on the right one.
- `download-backup-saves-the-importable-file`: Download backup saves `<workspace>.json` (read through the download event), the backup with the format stamp, the id, the base language and every language's texts.
- `import-reads-a-chosen-backup`: Import opens the file chooser, the chosen backup opens the Import a workspace dialog, and Import workspace creates the workspace with the file's languages and texts.
- `language-search-rules`: the picker's search ignores accents (`francais` finds Français), reads `fr_FR` as the code `fr-FR` (and adds it as `fr-FR`), and takes `french` as a name, never as a code.
- `i18next-lists-the-bare-language`: for `en` and `pt-BR` the i18next setup lists `supportedLngs` `["en", "pt", "pt-BR"]`.
- `import-reads-a-single-language-file`: a file named `it.json` is read as Italian: the dialog offers Italiano as the base, and Import creates the workspace with that file's texts.
- `fetch-snippet-loads-the-base-first`: the fetch setup merges the base, then the language, then the region, so the region wins.
- `toolbar-appears-from-four-workspaces`: the journey deletes the created workspaces, then with three workspaces (the project files, the installed modules and one created) the Workspaces page has no search field or sort menu, and with a fourth it has both and the search narrows the cards.
- `picker-marks-added-languages-and-finds-any-name`: The language picker lists a language already in the workspace apart and disabled, and finds a language by its name in the interface language too.
- `card-buttons-switch-browse-and-open`: A card's button reads Switch, Browse on the installed modules and Open on the current workspace, and Browse opens the matrix.
- `name-length-and-first-character`: A workspace name has at most 64 characters and starts with a letter or a digit; the dialog refuses the same names.
- `import-refuses-files-that-are-no-workspace`: Import says a JSON that is neither a backup nor a JSON of languages is none, and a backup of a newer version asks to update the module; neither opens the dialog.
- `import-reads-a-json-of-languages`: Import reads a JSON holding one object per language code, offers the file's languages and creates the workspace under the typed name.
- `settings-page-explains-itself`: The settings page links to the overview, keeps the name read-only with its warning, lists the languages with their coverage, and shows the About card; the project files show where their texts live instead.
- `copy-puts-the-url-and-the-setup-on-the-clipboard`: The Copy buttons of Use in your app put the public URL and the snippet on the clipboard.
- `scope-menu-gets-a-filter-from-seven-workspaces`: The workspace menu of the scope bar gets a filter field from seven workspaces on, and describes each workspace by its kind and languages.
- `switching-workspace-leaves-the-filters-behind`: Switching workspace from the scope bar keeps the page and drops the filters and the search of the workspace left.
- `workspaces-sort-and-search-by-description-and-type`: The sort menu orders the cards by name or least translated first, and the search matches the id, the description and the type.
- `right-to-left-languages-are-written-right-to-left`: The queue sets dir=rtl on the text of an Arabic translation and dir=ltr on an English one.
- `installed-modules-take-no-new-key`: The matrix of the installed modules offers no Add key, and the matrix of the project files does.

## How to get to it (user POV)

- Manage > Workspaces, and Manage > Workspace settings or Settings on a card.

## Driving it with dms-control

```bash
dms-control journey "$RUN" workspace-settings
```

## Gotchas

- The journey file is `journeys/workspace-settings.mjs`; it holds the Workspaces page journeys as well.
- Download backup and Import are driven through `tab.page`: `downloadOf` reads the download event, and the `filechooser` event takes the file. The import route itself is also driven by `backups`.
