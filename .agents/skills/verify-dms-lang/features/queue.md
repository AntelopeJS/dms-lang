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
- `ctrl-s-saves-and-stays`: Ctrl S saves the text and stays on the key.
- `queue-deep-links`: A queue URL without a language asks for one, mode= picks the keys walked, key= starts on a key and namespace= scopes the queue.
- `open-in-matrix-keeps-the-namespace`: Open in matrix filters on the keys the language lacks, in the namespace the queue is scoped to; on the base language it opens that namespace unfiltered.
- `download-the-language-file`: Download <code>.json saves the messages of the language, and removing a language offers the same file first.
- `a-draft-with-issues-needs-a-second-press`: A draft that uses a variable the base text lacks is saved on the second press, a broken one is not saved, and clearing a text asks first.
- `drafts-survive-a-language-switch`: A text typed and not saved is still there after going to another language and back.
- `skipped-keys-come-back-and-the-end-offers-more`: Skipped keys come back once the others are done, and a finished pass offers to review the issues.
- `a-namespace-the-language-lacks-leaves-the-url`: A queue link naming a namespace that does not exist walks every key.
- `the-queue-says-what-is-wrong-with-a-draft`: While a draft is typed the queue names each problem: a variable left out, one the base lacks, a space at an end, a lone @, an unclosed brace and another number of plural forms.
- `s-and-p-typed-in-the-field-are-text`: Typing s and p in the text field writes the letters and does not skip or go back.
- `keys-of-a-namespace-come-in-key-order`: Within a namespace the queue walks the missing keys in key order: auth.login, then auth.logout.
- `the-finished-pass-offers-the-least-complete-language`: When a language is done the queue offers the least complete other language first, and an unknown language lists them in that order.

## How to get to it (user POV)

- Translate > Translation queue, Translate on a language row, or `?locale=<code>`.

## Driving it with dms-control

```bash
dms-control journey "$RUN" queue
```

## Gotchas

- The queue's text field has the base text as its accessible name.
