---
name: verify-dms-lang-key-writes
description: "Exhaustively check that every key write the dms-lang API accepts on the project files (create, update, clear, delete, rename, drop override) leaves the dashboard showing what the docs promise and nothing else, for every set of up to two locale files. Use when a change touches src/utils/keys.ts, write-target.ts, json.ts, tree.ts, own.ts, registry.ts or locale-discovery.ts, or when `dms-control formal` reports key-writes."
---

# Verify dms-lang key writes

The project texts of a language live in several files (`app-fr-FR.json`, `app-crm-fr-FR.json`, …). The dashboard shows them merged, in sorted file-name order, a later file winning. A key write goes into one of them, the one `writeTargetOf` picks. If it picks the wrong one, or edits it the wrong way, the API answers 200 and the owner's change does not show, or another key appears or disappears. Tests reach a handful of file layouts. This check reaches all of them up to a bound.

**Property.** After any key operation the API accepts on the project files, the merged catalog shows exactly what the operation promises: the new text, or the text below the removed winning definition (`docs/3.configuration.md`, "Deleting a key…"), and every other key unchanged.

**Harm when it breaks.** A translator saves, the API says it saved, and the dashboard and the public files show the old text, or a key they never touched.

## How it checks

`check.mjs` is a bounded exhaustive check on the real code, not a model: there is no verifier for TypeScript that runs on this code, so it calls the built `dist/utils/keys.js` (`createKey`, `updateKey`, `deleteKey`, `renameKey`, `removeOverride`) on every input inside the bound and compares the result with the promise.

- **Files.** One language (`fr-FR`), one to two project files, each any shape over the names `a` and `b` two levels deep: a name absent, a text, an empty namespace, or a namespace of texts. `app-fr-FR.json` sits at every position or is absent; the other names (`app-blog`, `app-crm`, `app-shop`, `app-wiki`) sort in the enumerated order, so a counterexample reproduces in the product as printed.
- **Module texts.** None, `a.a`, or `b`.
- **Operations.** Every operation on each of the 6 keys (`a`, `b`, `a.a`, …), renames to each other key. An operation the API refuses (a 4xx) is skipped; only accepted ones are judged.
- **Store.** `storeOver` builds the key store as `ownKeyStore` in `src/utils/own.ts` does: messages merged as `readMessages` in `src/utils/registry.ts` merges them, `load` and `save` on the file `writeTargetOf` picks from the files as they are at that moment.

**Scopes.** *Consistent* files hold no empty namespace and no key that one file holds as a text and another as a namespace; the API never makes either, it answers `key_conflict`. Rules without a suffix judge consistent files. Rules ending in `.HandEdited` judge every other layout, which only a hand edit makes.

| Rule | Promise |
|---|---|
| `UpdateShows` | `PUT /key` with a text: the key shows that text, nothing else changes |
| `ClearRemovesWinner` | `PUT /key` with an empty text: only the winning definition goes |
| `CreateShows` | `POST /key`: the key shows its text, nothing else changes |
| `DeleteRemovesWinner` | `DELETE /key`: only the winning definition goes |
| `DropOverrideRemovesWinner` | `DELETE /key/override`: only the winning definition goes |
| `RenameMovesWinner` | `POST /key/rename`: the winning text shows under the new key, the old key shows what is left under it |
| `StaysConsistent` | an accepted operation on consistent files leaves them consistent |

`StaysConsistent` plus the six rules on consistent files cover every sequence of API calls that starts from consistent files: each step keeps its promise and lands on consistent files again.

## Run

```bash
pnpm run build                                              # the check loads dist/
node .agents/skills/verify-dms-lang-key-writes/check.mjs    # ~30 s
```

It prints `HOLDS <rule>` or `VIOLATED <rule>` with the smallest counterexample, then the number of accepted operations it checked. It exits 0 when the violated rules are exactly those in `record.json`, the known findings, and 1 otherwise, naming the rule that changed. `KEY_WRITES_MAX_FILES=3` raises the bound to three files: about 25 minutes and 5.6 million accepted operations; at `1918ac4` it gave the same verdict for every rule as two files.

Inside a `verify-dms-lang` run, `pnpm exec dms-control formal "$RUN"` runs it when the diff touches a covered file, with its evidence under `$RUN/evidence/formal/key-writes/`.

## Prove it can fail

```bash
node .agents/skills/verify-dms-lang-key-writes/seeded.mjs [rule...]   # ~1 min per break
```

`seeded-breaks/<rule>.patch` is one small bug in `src/` that breaks that rule. `seeded.mjs` applies each in a scratch worktree of HEAD, builds it, runs the check against it, and prints `CAUGHT <rule>` when that rule fails with a counterexample the unpatched HEAD does not give (a rule already in `record.json` is caught when its smallest counterexample changes), `MISSED` otherwise. It exits 0 only when every break is caught. Run it after you change `check.mjs`: a check that no longer catches its breaks proves nothing.

## Read a result

A new `VIOLATED` line on a change is one of two things.

- **A real bug.** Replay the counterexample in the product: in a `verify-dms-lang` run, write the printed files into `$RUN/root/.agents/skills/verify-dms-lang/playground/frontend-vue/i18n/locales/`, send the printed request with `dms-control api`, and read `GET /api/lang/translations/row?workspace=default&key=<key>`. If the row disagrees with the promise, it is a bug in the change. Report it with the counterexample; do not weaken the rule.
- **A modelling error.** The product does what the docs say and the check's promise (`operations()` in `check.mjs`) or store (`storeOver`) does not. Fix the check to match the docs or the code it mirrors, then run `seeded.mjs`.

A `no longer fails` line means a known finding is fixed: remove it from `record.json`.

## Known findings

Recorded in `record.json`; each was replayed in the product.

- **`StaysConsistent`: a rename hides an older definition instead of leaving it visible.** `app-fr-FR.json` = `{"b": "older"}`, `app-shop-fr-FR.json` = `{"b": "newer"}`, the layered override the docs allow. Rename `b` to `b.a`: 200. The shop file now holds the namespace `b`, which hides the text `b` of `app-fr-FR.json`: the dashboard shows `b.a` = "newer" and no `b`, though the docs say an older definition keeps the source key visible. Delete `b.a` and `b` = "older" shows again. The API checks the new name against the merged catalog without the moved key (`renameKey` in `keys.ts`), not against the files the older definition stays in.
- **`*.HandEdited`: a hand-edited empty namespace or text/namespace clash breaks every write.** An empty namespace counts as no key for the API's checks (`nodeKindAt` in `json.ts`) but still hides an earlier file's text in the merge (`deepMerge` in `tree.ts`): with `app-fr-FR.json` = `{}` and `app-shop-fr-FR.json` = `{"b": {}}`, `POST /key` `b` answers 200 and `b` does not show. A key that is a text in one file and a namespace in a later one makes a delete under the namespace bring the text back.

## Not covered

- More than three files, deeper keys or more than two names per level; three files only in the slower `KEY_WRITES_MAX_FILES=3` run.
- More than one language per operation: each language's files are written independently, by the same code.
- Workspaces you create: one file per language, so there is no write target to pick.
- The file system: `writeJson`'s layout, the cache in `cache.ts`, two processes writing the same file. All writes are synchronous in one Node process, so two requests never interleave inside one.
- What the dashboard renders from the merged catalog; the `project-files` journeys of `verify-dms-lang` drive that.

## Coverage record

Synced at `1918ac4`: the check describes these files at that commit.

| File | What the check relies on |
|---|---|
| `src/utils/keys.ts` | the five operations, called as is |
| `src/utils/write-target.ts` | `writeTargetOf`, called as is |
| `src/utils/json.ts` | `nodeKindAt`, `setAtPath`, `deleteAtPath`, called as is |
| `src/utils/tree.ts` | `deepMerge`, `leafPaths`, `getValueAtPath`, called as is |
| `src/utils/own.ts` | `ownKeyStore`, mirrored by `storeOver` |
| `src/utils/registry.ts` | `readMessages` and `getOwnWriteTarget`, mirrored by `merged` and `storeOver` |
| `src/utils/locale-discovery.ts` | files merged in sorted name order, mirrored by `fileNames` |

When a change touches a mirrored file, check that `storeOver`, `merged` and `fileNames` still do what it does. Move the sync commit forward only after you confirmed that, at the new commit.
