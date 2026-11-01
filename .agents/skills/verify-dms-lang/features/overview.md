---
covers:
  - src/pages/overview.ts
  - src/utils/blocks.ts
  - src/utils/notices.ts
  - frontend-vue/app/components/NamespaceCoverage.vue
  - frontend-vue/app/components/WorkspaceScope.vue
  - frontend-vue/app/utils/coverage.ts
  - frontend-vue/app/composables/translation/useFirstRun.ts
  - frontend-vue/app/composables/translation/useLangFormat.ts
  - frontend-vue/app/composables/translation/useLangLinks.ts
  - frontend-vue/app/composables/translation/useWorkspaceContext.ts
  - frontend-vue/app/composables/translation/useWorkspaceFlat.ts
  - frontend-vue/app/composables/translation/useWorkspaceFill.ts
  - frontend-vue/app/composables/translation/useWorkspaceLabel.ts
  - frontend-vue/app/composables/translation/useWorkspaceRoute.ts
  - frontend-vue/app/composables/translation/useI18nWorkspaces.ts
  - frontend-vue/app/composables/translation/useMutationToast.ts
  - frontend-vue/app/types/lang.ts
docs:
  - docs/4.usage/1.overview.md
---

# Overview

How translated is this workspace: four figures, the languages least complete first, the coverage by namespace and where the keys load from.

## Sub-features

- `use-in-your-app-and-the-heatmap-legend`: a created workspace's Use in your app card gives its `GET` URL and an example; the project files' card names `frontend-vue/i18n/locales/*-xx-XX.json` and says they are not served at a public URL; the heatmap legend reads ≥ 90%, 60–89%, < 60%.
- `kpis-and-coverage-by-namespace`: a workspace of three languages and four keys shows 3 languages, 4 keys in 2 namespaces, 4 missing translations across 2 languages and an average coverage of 50% without the base; each language row and each heatmap cell is labelled with its gaps; a heatmap cell opens the matrix on that namespace's missing keys.
- `header-action-targets-the-least-complete-language`: the primary action reads "Translate 3 missing in Deutsch" and opens the matrix filtered on German's gaps.
- `remove-a-language-asks-for-its-code`: the row menu lists the keys a new base lacks and can be cancelled; removing German needs its code typed and deletes `de.json`.
- `complete-workspace-has-no-missing-action`: a complete workspace has 0 missing translations, 100% average coverage and no Translate N missing action; Translate opens the queue and Edit base texts the matrix.
- `quick-actions-in-the-command-palette`: Ctrl K offers the four Lang actions, Add a translation key opens its dialog and the `action=add-language` deep link opens the picker.

## How to get to it (user POV)

- Modules > Translations > Translate > Overview.

## Driving it with dms-control

```bash
dms-control journey "$RUN" overview
```

## Gotchas

- Headings are styled in capitals: the journeys match their text without case.
