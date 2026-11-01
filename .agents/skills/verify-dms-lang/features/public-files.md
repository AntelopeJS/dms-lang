---
covers:
  - src/routes/publicLocales.ts
docs:
  - docs/5.extending.md
  - docs/3.configuration.md
  - docs/6.faq.md
---

# Public files

Every workspace a person creates is served as public JSON at `/i18n/<workspace>/<locale>.json`, to any origin and without credentials. The dashboard origin answers the same paths, because the module declares `/i18n/**` to the frontend server.

## Sub-features

- `serves-the-nested-tree`: the French file is the nested tree of the keys that have a French text (`{"checkout":{"pay":"Payer maintenant"}}`), the key with only a base text is absent, the base language holds every key, `Content-Language` names the locale, the dashboard origin answers the same body, and an edit shows on the next read.
- `no-cache-and-no-credentials`: `Cache-Control: no-cache`, `Access-Control-Allow-Origin: *` and no credentials header; the preflight answers 204 with the methods.
- `unknown-workspace-or-locale-is-404`: error path: a missing workspace or language is 404, a language without texts yet is a 200 with an empty tree.
- `private-workspaces-are-not-public`: the project files (`default`) and `modules` answer 404.
- `workspace-ids-are-case-insensitive`: `/i18n/<ID in capitals>/fr.json` reads the same file.

## How to get to it (user POV)

- Another app fetches `https://<apiBaseUrl>/i18n/<workspace>/<locale>.json`. The Overview and the workspace settings show the URL.

## Driving it with dms-control

```bash
dms-control journey "$RUN" public-files
```

## Gotchas

- The journeys read with plain `fetch` calls and keep the response headers in `response.json`.
- A workspace's files live under the run's `HOME`; every journey uses a fresh workspace id.
