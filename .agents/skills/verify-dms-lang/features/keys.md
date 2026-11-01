---
covers:
  - src/utils/keys.ts
  - src/utils/key-stores.ts
  - src/utils/message-check.ts
  - src/utils/message-syntax.ts
  - src/utils/review.ts
  - src/validation/key.schema.ts
  - frontend-vue/app/build/components/KeyAddModal.vue
  - frontend-vue/app/build/components/KeyRenameModal.vue
  - frontend-vue/app/build/components/PlaceholderText.vue
  - frontend-vue/app/composables/translation/useKeyActions.ts
  - frontend-vue/app/utils/keySaveErrors.ts
docs:
  - docs/4.usage/2.translation-matrix.md
  - docs/4.usage/5.workspace-settings.md
  - docs/5.extending.md
---

# Keys

A key is a dotted path; each language holds a text for it. People add, translate, rename and delete keys, and the module flags a text whose placeholders differ from the base text.

## Sub-features

- `create-translate-read`: a key with a base text is created, French lacks it, a French text with another placeholder, or without the base text's placeholder, is an issue of `fr`, the fixed text is not, an empty text removes the value and the last value of a key cannot be removed.
- `key-path-rules`: error path: a key that exists is 409 `key_exists`, a key under or above a text is 409 `key_conflict`, an empty segment, a space, an accent and `__proto__` are 400 `invalid_key_path`, an undeclared language is 400; none wrote a key.
- `message-syntax`: a bare `@` and an open brace are 400 `invalid_message`, a quoted `{'@'}`, a `{name}` and plurals are accepted, an update is checked the same way.
- `update-conflict`: a save that expected an old text is 409 `conflict` with the current text.
- `rename-and-delete-a-key`: a rename moves every language's text, a taken, identical or unknown path is refused, a delete removes the key from every language file.
- `mark-reviewed`: after the base text of a key of a created workspace changes, its French text is to review (`outdated: ["fr"]` on the row); marking it reviewed clears that, an unknown key is 404 and the project files answer 400 `review_added_only`.
- `texts-with-edge-values`: a plural, a quoted at sign, a text of two placeholders and a text of 1000 letters are stored as typed and count as missing in a language that lacks them.

## How to get to it (user POV)

- Translation matrix > Add key, a cell, the key panel; `PUT /api/lang/translations/key`.

## Driving it with dms-control

```bash
dms-control journey "$RUN" keys
```

## Gotchas

- Rows come back in the order of the base language's file, not sorted.
