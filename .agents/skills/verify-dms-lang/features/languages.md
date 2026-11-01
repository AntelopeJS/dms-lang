---
covers:
  - src/utils/languages.ts
  - src/utils/locale-codes.ts
  - src/utils/dialogs.ts
  - src/pages/languages-table.ts
  - frontend-vue/app/utils/languages.ts
  - frontend-vue/app/build/components/LanguageAddModal.vue
  - frontend-vue/app/build/components/LanguagePicker.vue
  - frontend-vue/app/build/components/LocaleTile.vue
  - frontend-vue/app/composables/translation/useLanguageActions.ts
  - frontend-vue/app/composables/translation/useLocaleNames.ts
docs:
  - docs/4.usage/1.overview.md
  - docs/4.usage/5.workspace-settings.md
  - docs/5.extending.md
---

# Languages

A workspace holds one JSON file per language. People add a language by BCP 47 code, remove one, or make another the base that every coverage is measured against.

## Sub-features

- `add-a-language`: `POST /locale` adds `fr`, `fr-BE` and `zh-Hant`, names the sibling of a regional variant, creates `<code>.json`, shows the native name and the coverage against the base; a duplicate is 409 `locale_exists`, a bad code 400 `invalid_locale`, an unknown workspace 404.
- `remove-a-language`: the removal confirmation names the file and the public URL it removes; removing deletes the file and its public URL and keeps the others; the base language is 409 `base_locale`.
- `make-a-language-the-base`: the base moves, `baseMissing` counts the keys the new base lacks and the missing count of the other languages follows.

## How to get to it (user POV)

- Overview > Add language; the row menu of a language; Workspace settings > Languages.

## Driving it with dms-control

```bash
dms-control journey "$RUN" languages
```

## Gotchas

- Language codes are normalised (`EN-us` is stored as `en-US`), which the journeys leave alone.
