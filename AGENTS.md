# @antelopejs/dms-lang

An AntelopeJS DMS module for language management over i18n workspaces (own, modules, added): an overview (coverage KPIs, ranked languages, namespace heatmap), a translation matrix with a key drawer, a per-language translation queue, a workspaces page and workspace settings. Every page shows the selected workspace in a scope bar and keeps it in the URL (`?workspace=`). Design rationale: [docs/design/v2-redesign-grill.md](./docs/design/v2-redesign-grill.md).

## Layout

| Path            | What it is                                                                                         |
| --------------- | -------------------------------------------------------------------------------------------------- |
| `src`           | The backend module: routes, pages, validation. Builds to `dist`                                    |
| `src/test`      | Mocha suites that `ajs module test` runs from `dist/test` against a booted DMS (`harness.ts`)      |
| `tests`         | `node:test` suites for the frontend helpers and the locale files. Some read the build output       |
| `frontend-vue`  | The Vue layer the DMS loads. ESLint and Prettier own it, not oxlint and oxfmt                      |
| `playground`    | A DMS project that loads this module, for `pnpm dev`                                               |
| `skills`, `docs`| Shipped with the package (`antelopeJs.skills`) and the source of dms.antelopejs.com/docs/modules/lang |

The module rewrites `**/i18n/locales/*.json` at run time with tab indentation, so oxfmt ignores them. Do not reformat them.

## Versions

The supported DMS versions are in the README's compatibility table. Keep these in step when you move to a new DMS minor:

- `@antelopejs/dms` and `@antelopejs/interface-dms` in `dependencies`, `devDependencies`, `playground/package.json` and the `dms` module of `src/test/harness.ts`.
- `@antelopejs/dms-frontend`, pinned in both `devDependencies` and capped below the next minor in `frontend-vue/package.json` `engines`.

A release that raises the DMS floor is breaking. List it under `### ⚠️ Breaking changes` in `CHANGELOG.md`, in a `docs(changelog)` pull request after the release commit.

## Tests

`pnpm test` builds once, then runs the `src/test` suites against an in-memory MongoDB and the `tests` suites. `pnpm run checks` runs it. It does not run `pnpm test:frontend`, which builds and typechecks `frontend-vue` against the DMS layer and has its own CI job. Run it when you change the Vue layer.

`pnpm knip:all` also reports unused files and exports. Expect findings: the DMS reaches components and composables through `import.meta.glob` and auto-imports. Confirm each one before you remove it.

## Orb

`.agents/setup` belongs to the guardrail pack. The MongoDB install, the build and the playground install live in `.agents/playground`, which the `dms-backend` service runs before it starts.

<!-- antelopejs-guardrails:start -->
<!-- Managed by @antelopejs/tooling-configs. `antelopejs-sync` rewrites everything between these markers; write repository-specific guidance outside them. -->

## Guardrails

Finish every change with `pnpm run checks`. It runs typecheck, lint, format, knip, tests, size, ratchet, and sync, and prints only what failed. The change is done when it prints no failure.

The tools enforce most rules, listed in the table at the end. The sections below hold the rules no tool checks.

### Comments

Say it in code. A constraint belongs in a type, a lint rule, or a test. A public item's contract belongs in TSDoc (`/** */`) on that item. The only other comments are lint directives that name their rules, `@ts-expect-error <reason>`, `SAFETY: <reason>` above a type assertion, `/*!` license headers, and bundler or formatter directives.

### Tests

Hold every test you write or keep to this checklist:

- Name the wrong implementation this test fails on. A test with no answer is deleted, not kept.
- No test reads the file it tests. Drive the behaviour through the public interface.
- An invariant over many files is a lint rule, not a test.

### Debt

`guardrails.ratchet.json` records the lint findings and oversize files this repository already had. Its numbers only go down. After you remove debt, run `pnpm run ratchet:update` and commit the lowered file. A rule listed there is off for `oxlint`. The ratchet counts it instead, and the pre-commit hook rejects it on every line you add.

### What enforces what

| Rule                                                                           | Enforced by                               |
| ------------------------------------------------------------------------------ | ----------------------------------------- |
| Formatting                                                                     | oxfmt                                     |
| Lint findings are errors; no rule warns                                        | oxlint preset                             |
| Comments are TSDoc, directives, or `SAFETY:` only                              | `antelopejs/no-comments`                  |
| Every test asserts                                                             | `antelopejs/require-assertion`            |
| Tests read no files outside fixtures, helpers, locales                         | `antelopejs/no-fs-read-in-tests`          |
| No assertion that restates a constant                                          | `antelopejs/no-constant-value-assertion`  |
| No test whose only check is "is a function"                                    | `antelopejs/no-typeof-function-only-test` |
| Params ≤ 5, function ≤ 120 lines, file ≤ 500 lines, depth ≤ 4, complexity ≤ 20 | `eslint/max-*`, `eslint/complexity`       |
| Files ≤ 20,000 bytes, tests included                                           | `antelopejs-check-size` (pre-commit)      |
| Existing debt only shrinks                                                     | `antelopejs-ratchet`                      |
| Types check                                                                    | `tsc` (pre-push)                          |
| No dead files, exports, or dependencies                                        | knip                                      |
| Managed files match the pack                                                   | `antelopejs-sync --check`                 |
| A test names the wrong implementation it catches                               | review; no tool                           |

<!-- antelopejs-guardrails:end -->
