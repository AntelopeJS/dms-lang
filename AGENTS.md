# @antelopejs/dms-lang

An AntelopeJS DMS module for language management over i18n workspaces (own, modules, added): an overview (coverage KPIs, ranked languages, namespace heatmap), a translation matrix with a key drawer, a per-language translation queue, a workspaces page and workspace settings. Every page shows the selected workspace in a scope bar and keeps it in the URL (`?workspace=`). Design rationale: [docs/design/v2-redesign-grill.md](./docs/design/v2-redesign-grill.md).

## Layout

| Path            | What it is                                                                                         |
| --------------- | -------------------------------------------------------------------------------------------------- |
| `src`           | The backend module: routes, pages, validation. Builds to `dist`                                    |
| `src/test`      | Mocha suites that `ajs module test` runs from `dist/test` against a booted DMS (`harness.ts`)      |
| `tests`         | `node:test` suites for the frontend helpers and the locale files. One reads the build output        |
| `frontend-vue`  | The Vue layer the DMS loads. ESLint and Prettier own it, not oxlint and oxfmt                      |
| `playground`    | A DMS project that loads this module, for `pnpm dev`                                               |
| `skills`        | Ships with the package and reaches users through `antelopeJs.skills`                               |
| `docs`          | The source of dms.antelopejs.com/docs/modules/lang. Not in the package                             |

The module rewrites `**/i18n/locales/*.json` at run time with tab indentation, so oxfmt ignores them. Do not reformat them.

## Versions

The supported DMS versions are in the README's compatibility table. Keep these in step when you move to a new DMS minor:

- `@antelopejs/dms` in `devDependencies`, `playground/package.json` and the `dms` module of `src/test/harness.ts`.
- `@antelopejs/interface-dms` in `dependencies` and `playground/package.json`.
- `@antelopejs/dms-frontend`, pinned in the root and playground `devDependencies`, and capped below the next minor in `frontend-vue/package.json` `engines`.

A release that raises the DMS floor is breaking. List it under `### ⚠️ Breaking changes` in `CHANGELOG.md`, in a `docs(changelog)` pull request after the release commit.

## Tests

`pnpm test` builds once, then runs the `src/test` suites against an in-memory MongoDB and the `tests` suites. `pnpm run checks` runs it. It does not run `pnpm test:frontend`, which builds and typechecks `frontend-vue` against the DMS layer and has its own CI job. Run it when you change the Vue layer.

<!-- antelopejs-guardrails:start -->
<!-- Managed by @antelopejs/tooling-configs. `antelopejs-sync` rewrites everything between these markers; write repository-specific guidance outside them. -->

## Guardrails

CI runs `pnpm run checks` in full on every pull request and reports what failed. The commit hook formats and lints the staged files. Locally, run only the fast check for what you touched:

- `pnpm run typecheck` after you change types or signatures.
- `pnpm exec oxlint <files>` and `pnpm exec oxfmt <files>` on the files you changed.
- One test file, not the suite. In a module that tests with `ajs module test`: `pnpm run build`, then `pnpm exec ajs module test . -f dist/<path>.test.js`.

Prove a change works with the verification skill in [`.agents/skills/verify-dms-lang/SKILL.md`](.agents/skills/verify-dms-lang/SKILL.md) before you call it done.

### Comments

Say it in code: a constraint in a type, a lint rule or a test, a public item's contract in TSDoc. Other comments are lint directives naming their rules, `@ts-expect-error <reason>`, `SAFETY: <reason>` above a type assertion, and license or tool directives. A reason states what the code does now.

### Tests

Each test names the wrong implementation it fails on, or is deleted. Drive behaviour through the public interface. An invariant over many files is a lint rule.

### Review

No tool checks these:

- A type guard checks the nested elements and values it claims.
- A no-upward import rule rejects same-tier peers; probe it with an import.
- A finding only an evasion or a patched internal can trigger goes under Attention and never blocks.

### Suppressions

`guardrails.suppressions.json` caps lint directives, `@ts-expect-error`, `SAFETY:` comments and rules a lint config turns off. Over a cap, fix the code or remove another suppression of that kind; only the operator raises a number. After removing suppressions, run `pnpm run suppressions:update` and commit the file.

<!-- antelopejs-guardrails:end -->
