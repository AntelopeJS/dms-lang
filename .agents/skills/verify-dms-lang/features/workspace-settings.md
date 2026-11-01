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

- `new-workspace-dialog`: `?action=new-workspace` opens the dialog on arrival, the button stays disabled without a name, the dialog previews the public URL, and Create stores the workspace with its description and type and lists it.
- `switch-the-current-workspace`: a page opened without `?workspace=` goes to the workspace used last, the scope bar's switcher moves every page, and the next page follows.
- `settings-save-as-you-go`: a description and a type typed on the settings page are stored without a Save button; the About card shows the kind, the folder and the figures.
- `snippets-for-your-app`: the Use in your app card gives the URL, the fallback rule and one snippet each for vue-i18n, i18next, fetch and curl; the snippet route returns the same code.
- `rename-from-the-danger-zone`: Rename shows the URL before and after, the public URL moves and the old one answers 404.
- `delete-needs-the-name-typed`: Delete lists the files and strings it removes, offers a backup, ignores a wrong name and deletes on the right one.

## How to get to it (user POV)

- Manage > Workspaces, and Manage > Workspace settings or Settings on a card.

## Driving it with dms-control

```bash
dms-control journey "$RUN" workspace-settings
```

## Gotchas

- The journey file is `journeys/workspace-settings.mjs`; it holds the Workspaces page journeys as well.
- The Import button opens a file chooser, which the journeys do not drive; the import route is driven by `backups`.
