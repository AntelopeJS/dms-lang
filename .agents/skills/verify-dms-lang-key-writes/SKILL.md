---
name: verify-dms-lang-key-writes
description: "Exhaustively check that every key write the dms-lang API accepts on the project files (create, update, clear, delete, rename, drop override) lands in the file the docs name and leaves the dashboard showing what the docs promise and nothing else, for every set of up to two locale files. Use when a change touches src/utils/keys.ts, write-target.ts, json.ts, tree.ts, own.ts, registry.ts, locale-discovery.ts or the files they import (guards, errors, message-syntax, locale-codes, cache), or when `dms-control formal` reports key-writes."
---

# Verify dms-lang key writes

The project texts of a language live in several files (`app-fr-FR.json`, `app-crm-fr-FR.json`, …). The dashboard shows them merged, in sorted file-name order, a later file winning. A key write goes into one of them, the one `writeTargetOf` picks. If it picks the wrong one, or edits it the wrong way, the API answers 200 and the owner's change does not show, lands in a file the docs did not name, or another key appears or disappears. Tests reach a handful of file layouts. This check reaches all of them up to a bound.

**Property.** After any key operation the API accepts on the project files, the merged catalog shows exactly what the operation promises (the new text, or the text below the removed winning definition), every other key unchanged, and only the file `docs/3.configuration.md` ("Project files") names was written.

**Harm when it breaks.** A translator saves, the API says it saved, and the dashboard and the public files show the old text, a key they never touched, or the edit sits in a file the developer did not expect.

## How it checks

`check.mjs` is a bounded exhaustive check on the real code, not a model: there is no verifier for TypeScript that runs on this code, so it calls the built `dist/utils/keys.js` (`createKey`, `updateKey`, `deleteKey`, `renameKey`, `removeOverride`) on every input inside the bound and compares the result with the promise. Its expectations are written from the docs with code of their own, not with the product's helpers. It imports the product through `product/index.mjs`, which loads `dist/` at run time; `product/index.d.mts` types the same names from `src/`, so lint and typecheck work before a build.

- **Files.** One language (`fr-FR`), one to two project files, each any shape over the names `a` and `b` two levels deep: a name absent, a text, an empty namespace, or a namespace of texts. `app-fr-FR.json` sits at every position or is absent; the other names (`app-blog`, `app-crm`, `app-shop`, `app-wiki`) sort in the enumerated order, so a counterexample reproduces in the product as printed.
- **Module texts.** None, `a.a`, or `b`.
- **Operations.** Every operation on each of the 6 keys (`a`, `b`, `a.a`, …): renames to each other key, and creates both appended and placed `before` each sibling. An operation the API refuses with a 4xx (`fail()` in `src/utils/errors.ts`) that leaves the files as they were is skipped. A 4xx that changed the files, or any other throw, a 500 included, breaks the operation's rule.
- **Store.** `storeOver` builds the key store as `ownKeyStore` in `src/utils/own.ts` does: messages merged as `readMessages` in `src/utils/registry.ts` merges them, `load` and `save` on the file `writeTargetOf` picks from the files as they are at that moment. A review compared it with the real `ownKeyStore` on real files, locale code `fr`, over all 712,800 cases: no divergence.

**Scopes.** *Consistent* files hold no empty namespace and no key that one file holds as a text and another as a namespace; the API never makes either, it answers `key_conflict`. Rules without a suffix judge consistent files. Rules ending in `.HandEdited` judge every other layout, which only a hand edit makes.

| Rule | Promise |
|---|---|
| `UpdateShows` | `PUT /key` with a text: the key shows that text, nothing else changes |
| `ClearRemovesWinner` | `PUT /key` with an empty text: only the winning definition goes, with the namespaces it leaves empty |
| `CreateShows` | `POST /key`: the key shows its text, nothing else changes |
| `DeleteRemovesWinner` | `DELETE /key`: only the winning definition goes, with the namespaces it leaves empty |
| `DropOverrideRemovesWinner` | `DELETE /key/override`: only the winning definition goes, with the namespaces it leaves empty |
| `RenameMovesWinner` | `POST /key/rename`: the winning text shows under the new key, and the old key shows the older definition when another file has one ("an older definition can keep the source key visible") |
| `WritesWhereDocsSay` | only the file the docs name is written: the one whose value shows for an existing key; for a new key (a module key's first override included) a file holding its namespace (any of them on a tie, which the docs leave open), else the last `app-fr-FR.json`, else the last file. With keys two segments deep, a namespace is one segment, so "the longest part" is not tested |
| `CreatePlacedBefore` | `POST /key` with `before`: in a written file that holds that sibling, the key sits right before it (`createKey`'s TSDoc) |
| `StaysConsistent` | an accepted operation on consistent files leaves them consistent |

`StaysConsistent` plus the rules on consistent files cover every sequence of API calls that starts from consistent files: each step keeps its promise and lands on consistent files again.

## Run

```bash
pnpm run build                                              # the check loads dist/
node .agents/skills/verify-dms-lang-key-writes/check.mjs    # 15 to 20 s
```

It prints one line per rule: `HOLDS`; `KNOWN` for a finding `record.json` lists under `violated` with the same number of failing cases; or `VIOLATED`, with the smallest counterexample and its number of failing cases under it. Then the number of accepted operations it checked. `record.json` maps each known finding to its number of failing cases at the default bound, so a change that makes a known finding worse, or partly fixes it, prints `VIOLATED` and says which. It exits 0 when its rules are exactly those `record.json` lists, under `holds` or `violated`, and every failing one is `KNOWN`; it exits 1 otherwise and names the rule that changed. `KEY_WRITES_MAX_FILES=3` raises the bound to three files, about 15 minutes; at that bound counts are not compared, only which rules fail.

Inside a `verify-dms-lang` run, `pnpm exec dms-control formal "$RUN"` runs it when the diff touches a covered file or this folder, with its evidence under `$RUN/evidence/formal/key-writes/`. The gate fails when the check exits 1 or prints a `VIOLATED` line; `KNOWN` lines pass, and its `result.json` lists them under `passing`. When the diff changes the covered code's behaviour or this folder, it also runs `base.mjs` in a worktree of the base: that builds the base's `src/`, runs the base's own copy of this check (this folder's, when the base has none), and adds a `VIOLATED` line, under a name HEAD never reports, for each way HEAD's `record.json` could hide a regression: a rule the base checks that HEAD no longer lists (`<rule>`), a rule HEAD records with more failing cases than the base shows, a holding rule included (`RecordedRegression.<rule>`), and a base that does not build (`BaseChecked`, its error in `base-stderr.txt`). The gate fails each as absent at HEAD.

## Prove it can fail

```bash
node .agents/skills/verify-dms-lang-key-writes/seeded.mjs [rule...]   # ~25 s per break
```

`seeded-breaks/<rule>.patch`, and `<rule>--<what it does>.patch` for more breaks of one rule, is one small bug in `src/` that breaks that rule. Five come from the review: `before` deleting a sibling, a write before a 409, a crash after a save, a new key landing in the first file, and `before` losing its anchor. `seeded.mjs` applies each in a scratch worktree of HEAD, builds it, runs the current check against it, and prints `CAUGHT <break>` when its rule prints `VIOLATED`, `MISSED` otherwise. It first runs the unpatched HEAD and stops when that prints any `VIOLATED` line. It exits 0 only when every break is caught, and 1 for a name with no patch. `scratch.mjs` holds the worktree preparation that `seeded.mjs` and `base.mjs` share. Run it after you change `check.mjs`: a check that no longer catches its breaks proves nothing.

## Read a result

A `VIOLATED` line on a change is one of two things.

- **A real bug.** Replay the counterexample in the product: in a `verify-dms-lang` run, write the printed files into `$RUN/root/.agents/skills/verify-dms-lang/playground/frontend-vue/i18n/locales/` (move the shipped `app-*.json` aside and put them back after), send the printed request with `pnpm exec dms-control api "$RUN" <method> /api/lang/translations<route> --body '<json>'`, and read `GET /api/lang/translations/row?workspace=default&key=<key>` (its `row` field is absent when no text shows) and the files. If they disagree with the promise, it is a bug in the change. Report it with the counterexample; do not weaken the rule. The printed texts (`f0:b`) only name the file and key that hold them; any text replays the case.

  | Printed request | Route and body |
  |---|---|
  | `POST /key <k> = "new"` | `POST /key` `{"workspace":"default","path":"<k>","values":{"fr":"new"}}`, plus `"before":"<sibling>"` |
  | `PUT /key <k> = "new"` or `= ""` | `PUT /key` `{"workspace":"default","path":"<k>","values":{"fr":"new"}}` (or `""`) |
  | `DELETE /key <k>` | `DELETE /key` `{"workspace":"default","path":"<k>"}` |
  | `DELETE /key/override <k>` | `DELETE /key/override` `{"workspace":"default","path":"<k>"}` |
  | `POST /key/rename <k> -> <n>` | `POST /key/rename` `{"workspace":"default","path":"<k>","newPath":"<n>"}` |
- **A modelling error.** The product does what the docs say and the check's promise (`operations()`, `withoutWinner`, `newKeyFiles` in `check.mjs`) or store (`storeOver`) does not. Fix the check to match the docs or the code it mirrors, then run `seeded.mjs`.

A `no longer fails` line means a known finding is fixed: move it from `violated` to `holds` in `record.json`.

## Known findings

Recorded in `record.json`; each was replayed in the product.

- **`RenameMovesWinner`: a rename hides an older definition instead of leaving it visible.** `app-fr-FR.json` = `{"b": "older"}`, `app-shop-fr-FR.json` = `{"b": "newer"}`, the layered override the docs allow. Rename `b` to `b.a`: 200. The shop file now holds the namespace `b`, which hides the text `b` of `app-fr-FR.json`: the dashboard shows `b.a` = "newer" and no `b`, though the docs say an older definition keeps the source key visible. Delete `b.a` and `b` = "older" shows again. The API checks the new name against the merged catalog without the moved key (`renameKey` in `keys.ts`), not against the files the older definition stays in. Replayed on a `verify-dms-lang` run, twice: after the rename, `GET /row?key=b` answers no `row`; after the delete, `{"fr":"older"}`.
- **`UpdateShows`, `CreateShows`, `RenameMovesWinner` `.HandEdited`: a hand-edited empty namespace hides a write.** An empty namespace counts as no key for the API's checks (`nodeKindAt` in `json.ts`) but still hides an earlier file's text in the merge (`deepMerge` in `tree.ts`): with `app-fr-FR.json` = `{}` and `app-shop-fr-FR.json` = `{"b": {}}`, `POST /key` `b` answers 200 and `b` does not show.
- **`ClearRemovesWinner.HandEdited`: clearing a key no file defines uncovers another.** With `app-fr-FR.json` = `{"a": "f0:a"}`, `app-shop-fr-FR.json` = `{"a": {}}` and the module text `a.a`, `PUT /key` `a.a` = `""` answers 200, prunes the empty `a` of the shop file, and `a` = "f0:a", hidden until then, shows.

## Not covered

- More than three files, deeper keys or more than two names per level; three files only in the slower `KEY_WRITES_MAX_FILES=3` run.
- More than one language per operation: each language's files are written independently, by the same code.
- Which of several files tied on the longest namespace a new key lands in: the docs leave it open.
- The longest-namespace clause beyond one segment (`crm.deals.title` going to the file with `crm.deals` rather than the one with `crm`): keys are two segments deep. The `project-files` journeys of `verify-dms-lang` drive that case in the product.
- The order of keys, except a create with `before` in a file that holds that sibling.
- Workspaces you create: one file per language, so there is no write target to pick.
- The file system: `writeJson`'s layout, the cache in `cache.ts`, two processes writing the same file. All writes are synchronous in one Node process, so two requests never interleave inside one.
- What the dashboard renders from the merged catalog; the `project-files` journeys of `verify-dms-lang` drive that.

## Coverage record

Synced at `1918ac4`: the check describes these files at that commit.

| File | What the check relies on |
|---|---|
| `src/utils/keys.ts` | the five operations, called as is |
| `src/utils/write-target.ts` | `writeTargetOf`, called as is |
| `src/utils/json.ts` | `nodeKindAt`, `setAtPath`, `insertAtPath`, `deleteAtPath`, run as is |
| `src/utils/tree.ts` | `deepMerge`, `leafPaths`, `getValueAtPath`, called as is |
| `src/utils/guards.ts`, `errors.ts`, `message-syntax.ts`, `locale-codes.ts`, `cache.ts` | imported by the files above, run as is |
| `src/utils/own.ts` | `ownKeyStore`, mirrored by `storeOver` |
| `src/utils/registry.ts` | `readMessages` and `getOwnWriteTarget`, mirrored by `merged` and `storeOver` |
| `src/utils/locale-discovery.ts` | files merged in sorted name order, mirrored by `fileNames` |

When a change touches a mirrored file, check that `storeOver`, `merged` and `fileNames` still do what it does. Move the sync commit forward only after you confirmed that, at the new commit.
