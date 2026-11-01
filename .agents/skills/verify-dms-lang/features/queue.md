---
covers:
  - src/pages/language.ts
  - frontend-vue/app/components/TranslationQueue.vue
  - frontend-vue/app/components/LanguageNamespaces.vue
  - frontend-vue/app/build/components/queue/**
  - frontend-vue/app/build/composables/useQueue*.ts
  - frontend-vue/app/utils/queue*.ts
  - frontend-vue/app/composables/translation/useLanguageQueue.ts
  - frontend-vue/app/composables/translation/useQueue*.ts
docs:
  - docs/4.usage/3.translation-queue.md
---

# Translation queue

One language, one key at a time, with the base text, the keys that come next and the language's figures.

## Sub-features

- `translate-key-by-key`: French is missing two of four keys; the queue shows the least complete namespace first (`auth.logout`, base text `Bye`), Save & next stores the text and brings up `shop.pay`, Ctrl Enter saves the last key and the queue says French is done. Up next lists `shop.pay` with its base text, never the key on screen.
- `skip-and-previous`: Skip moves on without writing, Previous comes back, and the skipped key is still missing.
- `tabs-and-side-panel`: the Missing, Issues and All tabs count 2, 1 and 4; the side panel gives coverage 50%, translated 2, missing 2, issues 1; a namespace scopes the queue.
- `base-and-unknown-language`: the base language and an unknown `?locale=` each get their own message.
- `escape-then-s-skips`: Escape then S skips, Escape then P goes back, and Open in matrix lists the keys French lacks.
- `overflow-menu-makes-base-or-removes`: More actions > Remove language names the public file and removes German only once `de` is typed; Make base language lists the keys French lacks and makes French the base.

## How to get to it (user POV)

- Translate > Translation queue, Translate on a language row, or `?locale=<code>`.

## Driving it with dms-control

```bash
dms-control journey "$RUN" queue
```

## Gotchas

- The queue's text field has the base text as its accessible name.
