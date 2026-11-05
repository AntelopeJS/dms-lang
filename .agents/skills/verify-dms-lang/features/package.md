---
covers:
  - package.json
  - skills/**
  - frontend-vue/package.json
  - frontend-vue/dms.frontend.ts
  - frontend-vue/dms.frontend.build.ts
  - frontend-vue/build/**
  - frontend-vue/i18n/locales/**
  - src/index.ts
  - src/frontend-module.ts
docs:
  - docs/2.installation.md
  - README.md
---

# Package

What an app developer installs from the registry: the build, the dashboard layer, the module's own texts and the agent skill.

## Sub-features

- `tarball-holds-what-the-manifest-points-at`: `npm pack` holds `dist`, `frontend-vue` (with the module's own locale files and the renderer range) and `skills`, every path `main`, `types`, `exports`, `dmsFrontend` and `antelopeJs.skills` names resolves inside it, and tests, build info and sources stay out.
- `published-name-and-interface-ranges`: the package is `@antelopejs/dms-lang`, public, depends on the three interfaces and implements none.

## How to get to it (user POV)

- `ajs project modules add @antelopejs/dms-lang`.

## Driving it with dms-control

```bash
dms-control journey "$RUN" package
```

## Gotchas

- The journeys pack with `npm pack --ignore-scripts`, so the build in `dist` is the one under test.
