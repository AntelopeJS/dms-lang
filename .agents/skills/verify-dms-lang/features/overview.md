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
- `one-missing-text-keeps-coverage-under-100`: an import of 201 keys with French holding 200 reads French 99 (rounded down, so one missing text never reads 100) and a complete German 100.
- `namespaces-rank-by-share-of-missing-texts`: `/namespaces` lists the namespace with the largest share of missing texts first (1 of 1 missing before 2 of 10).
- `header-action-targets-the-least-complete-language`: the primary action reads "Translate 3 missing in Deutsch" and opens the matrix filtered on German's gaps.
- `remove-a-language-asks-for-its-code`: the row menu lists the keys a new base lacks and can be cancelled; removing German needs its code typed and deletes `de.json`.
- `complete-workspace-has-no-missing-action`: a complete workspace has 0 missing translations, 100% average coverage and no Translate N missing action; Translate opens the queue and Edit base texts the matrix.
- `quick-actions-in-the-command-palette`: Ctrl K offers the four Lang actions, Add a translation key opens its dialog and the `action=add-language` deep link opens the picker.
- `heatmap-shows-six-by-six-and-links-to-the-matrix`: The heatmap shows at most six namespaces and six languages and then offers See all in the matrix; a smaller workspace hides nothing.
- `heatmap-cell-without-gaps-opens-the-namespace`: A heatmap cell of a complete language opens the matrix on its namespace without the missing filter.
- `languages-rank-the-base-first-then-least-complete`: The languages table pins the base language on top and lists the others least complete first.
- `add-language-belongs-to-created-editable-workspaces`: The Add language action and an Editable scope bar show on a workspace you created, not on the project files or the installed modules (Read-only).
- `a-workspace-without-keys-shows-its-first-steps`: A workspace you created with no key yet shows its first steps in place of figures and a heatmap.
- `heatmap-tones-switch-at-90-and-60`: A heatmap cell is green from 90%, amber from 60 to 89% and red below 60%.

## How to get to it (user POV)

- Modules > Translations > Translate > Overview.

## Driving it with dms-control

```bash
dms-control journey "$RUN" overview
```

## Gotchas

- Headings are styled in capitals: the journeys match their text without case.
