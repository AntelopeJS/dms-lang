---
covers:
docs:
  - docs/1.introduction.md
---

# Smoke

The fixed journey every verdict runs, whatever the diff touches: the introduction's "Publish one translated message", through the dashboard.

## Sub-features

- `smoke`: the owner signs in, creates a workspace in Workspaces > New workspace, adds French from the Overview, adds the key `checkout.pay` with the English text `Pay now` in the matrix, types `Payer maintenant` in the French cell, and `/i18n/<workspace>/fr.json` serves `{"checkout":{"pay":"Payer maintenant"}}`; a reload and the API show the same texts.

## How to get to it (user POV)

- Open the dashboard, sign in, Modules > Translations.

## Driving it with dms-control

```bash
dms-control journey "$RUN" smoke
```

## Gotchas

- The workspace id is unique per run, so the journey needs no clean up.
