# dms-lang v2 redesign: grill session

Self-answered design review of the dms-lang migration to `@antelopejs/dms` 0.6 /
`@antelopejs/interface-dms` 0.4 / `@antelopejs/dms-frontend` 0.5 and of the v2
design (`dms-design-mockup/modules/lang`). Every question was asked against the
code, the mockup, the UX review (`modules/lang/review.html`, findings L-01 to
L-14) and the DMS migration guide (`docs/02.building/13.migration-0-3-to-0-4.md`
in AntelopeJS/dms). Each answer is the recommendation that was taken.

## 1. Dependencies and platform

**Q1.1 Which versions does the module move to?**
`@antelopejs/interface-dms` `>=0.4.0 <1.0.0`, `@antelopejs/dms` `>=0.6.0 <0.7.0`
(dev, test harness, playground), `@antelopejs/dms-frontend` 0.5.0 (dev) with the
frontend `engines` range `>=0.5.0 <0.6.0`, `@antelopejs/core` 1.13.5. The test
harness and playground also move to `@antelopejs/mongodb` 1.4.2 (required by
the DMS 0.6), `@antelopejs/api` 1.3.3 and `@antelopejs/file-storage-local` 0.1.6.

**Q1.2 The migration guide writes the interface range as `<0.5.0`; why `<1.0.0`?**
`antelopejs-check-interface-ranges` (run by `pnpm lint`) refuses any interface
range that stops before the next major. The tooling is the gate CI runs, so it
wins; the DMS itself declares `>=0.4.0 <0.5.0` because it is the implementer.

**Q1.3 What breaks in the frontend layer?**
- Nothing is auto-imported without a `dms.frontend.build.ts` (dms-frontend 0.4):
  the module adds one declaring `app/composables`, `app/utils` and `app/types`.
  The `app/composables/translation/` subfolder stays: the scan is recursive.
- Components are prefixed by the module (dms-frontend 0.5): the module declares
  `componentPrefix: "DmsLang"` and registers bare names. **DmsLang** rather than
  **Lang**: the backend names (`DmsLangOverview`, …) stay stable and the prefix
  is unlikely to collide with another module. Custom pages are no longer
  registered: every screen is a backend page.
- `useConfirm()` takes `color`, not `confirmColor`.
- `build/` components of the DMS are private: the module only uses root
  components (`DmsCard`, `DmsStatGroup`, `DmsMeter`, `DmsEmptyState`,
  `DmsBanner`, `DmsSection`, `DmsFieldRow`, `DmsSegmented`, `DmsStatusPill`,
  `DmsIconWell`, `DmsSectionHeader`, `DmsEyebrow`, `DmsCopyButton`,
  `DmsCheckList`, `DmsKeyValueList`) and public composables (`useConfirm`,
  `usePageHeaderActions`, `useRegionalFormat`, `useAuthFetch`, …).

**Q1.4 What breaks in the backend?**
Nothing in the TypeScript surface the module uses (`tsc` passes on 0.4). The
behaviour changes that matter: module pages are platform-owner only (unchanged
for this module, whose routes were already `@AuthOwnerOnly`), and `KpiCard` is
superseded for headline figures by `StatGroup` (`StatStrip` renamed).

## 2. Information architecture

**Q2.1 Which screens does the module ship?**
The mockup's five, all declared as backend pages under the `lang` module:

| Nav group | Page | Slug | Content |
| --- | --- | --- | --- |
| Translate | Overview | `overview` | Scope bar, KPIs, ranked languages, namespace heatmap, "Use in your app" |
| Translate | Translations | `translations` | Matrix with per-cell state, filters, key drawer |
| (hidden) | Language | `language` | Translation queue for one language (`?locale=`) |
| Manage | Workspaces | `workspaces` | Every workspace with its kind, size and coverage |
| (hidden) | Workspace settings | `workspace` | Name, base language, languages, app snippets, danger zone (`?workspace=`) |

**Q2.2 Where do the nav groups come from?**
Two `Category` entries under the module root returned by `RegisterModule`:
`translate` and `manage`. The "Design review" group of the mockup is mockup-only.

**Q2.3 The Translations nav badge shows the missing count. Is it implemented?**
Yes, with `navBadge` on the matrix component. The server does not know which
workspace the browser selected, so the badge counts the missing translations
of the **project files** workspace, the one that ships with the dashboard and
the count a platform owner acts on first.

**Q2.4 Does the sidebar workspace widget stay?**
No. The UX review (L-01, L-11) moves selection to a scope bar shown on every
page and management to the Workspaces page. Keeping the widget would leave two
switchers; it is removed with its plugin.

**Q2.5 How is the selected workspace carried?**
Still a shared client state (`useDmsState`), now mirrored in the URL
(`?workspace=`): a link to a page or a refresh lands on the same workspace, and
the scope bar always names it (L-01).

## 3. Pages declared on the backend

**Q3.1 Can the pages be built from DMS blocks instead of custom components?**
Partly. Every block that fetches (`StatGroup`, `KeyValueList`, `ActivityFeed`,
`Meter`) reads a static `fetchUrl`, which cannot follow a workspace the user
picks in the browser. So:
- static content and layout use blocks: the workspace kinds explainer on the
  Workspaces page is a `StatGroup` (joined layout), the "Keys live in every
  language" note of the workspace settings is a `Banner`, and the two-column
  pages are a `Grid` / `GridRow` with a `VStack` side column;
- workspace-bound content is a custom component per section, each built from
  the DMS root components listed in Q1.3 rather than hand-made markup.

**Q3.2 How are the custom components declared?**
One static field per section, each a `CustomComponent("DmsLang…")` with
`.meta({ name, description, icon })` whose texts are `$dms_lang.permissions.…`
i18n keys, so the permission tree and role previews read a proper name. Write
operations are declared as component actions (`.action("edit", { title })`)
and the routes check them with `@AuthUserWithPermission(action)`.

**Q3.3 Module pages are owner-only. Why declare actions at all?**
Module permission ids exist (`modules.lang.…`) even if only the owner holds
them today. Every write route now checks its action with
`@AuthUserWithPermission(action)` (edit values, manage keys, create, rename and
delete workspaces, manage languages) on top of the controller's
`@AuthOwnerOnly()`, which stays for the reads because a DMS module is an owner
area by design. If module access is ever opened to roles, the writes already
name their permission. The public `/i18n/:workspace/:locale` route stays
public.

**Q3.4 Do header actions come from the backend (`headerActions`)?**
No: their labels and availability depend on the selected workspace ("Translate
1,154 missing", "Add language" only on a workspace you manage). The custom
component of each page sets them with `usePageHeaderActions`. The command
palette gets backend quick actions (`QuickAction` with `navigate` targets and
an `action` query the page reacts to): New workspace, Add language, Add key,
Translate missing.

**Q3.5 The Language page title is the language in the mockup ("Italiano"). Can
the page header show it?**
No: a page header shows the page's `displayName`. The page is titled
"Language" and the queue card names the language and its code. Recorded as a
gap against the mockup.

## 4. Overview

**Q4.1 KPIs?**
`DmsStatGroup` in the `cards` layout, with the labels the review asks for
(L-08): "Languages · 1 base, N translated from it", "Translation keys · in N
namespaces", "Missing translations · empty cells across N languages",
"Average coverage · excluding the base language". The mockup's "+38 this
month" needs a history the module does not keep: dropped.

**Q4.1b How are languages named?**
By their native name without the region ("Italiano", not "Italiano (Italia)"),
from `Intl.DisplayNames`; the code next to it (`it-IT`) carries the region and
the tile carries the language (`IT`).

**Q4.2 Language cards or a list?**
The ranked list (L-09): base pinned first, then least complete; a code tile
instead of a flag (a language is not a country); one Translate button with the
missing count; rare actions (make base, remove) in an overflow menu. A
Coverage / Name segmented control sorts it.

**Q4.3 Namespace heatmap?**
Computed in the browser from `GET /flat` (namespace = first key segment), five
namespaces × the non-base languages, coloured ≥ 90 / 60–89 / < 60, each cell
links to the matrix filtered on that namespace and language.

**Q4.4 First run, loading, error, read-only?**
- First run (added workspace with no key): `DmsEmptyState` + `DmsCheckList`
  checklist with "Add first key" and "Add language".
- Loading: skeleton rows, the layout never jumps.
- Load failure: `DmsEmptyState` `variant="error"` with "Try again", previous
  numbers hidden.
- Modules workspace: a warning `DmsBanner` "Keys shipped by installed modules"
  with "Browse keys".

## 5. Translations matrix

**Q5.1 Keep the virtualised fixed-height grid?**
No. The review (L-05) wants wrapping cells. Rows are grouped by namespace with
a collapsible header, cells wrap, and the matrix draws 150 rows at a time
("Show more") so a 2,000-key workspace stays responsive without
virtualisation.

**Q5.2 Cell editing?**
Click a cell to edit in a textarea with a length counter; ⌘/Ctrl+Enter or blur
saves; Escape cancels. Each cell shows its own state: Saving, Saved, Not saved
with Retry, the text kept (L-03). Failure toasts name the key and the language.

**Q5.3 Placeholders?**
`{name}` tokens render as tokens; a cell whose placeholders differ from the
base text is flagged "{amount} missing" (L-06), in the matrix, the drawer and
the queue. Pure client-side check.

**Q5.4 What does "Missing" count when columns are hidden?**
A "Missing in" filter (any language or one) independent of the shown columns
(L-07). Column headers carry their missing count and a coverage bar.

**Q5.5 Key editor drawer?**
Clicking a key opens a slideover with every language stacked, the base text as
reference, placeholder checks with "Insert {token}", previous / next key,
rename and delete, and Save (all changed languages in one request).

**Q5.6 Add, rename, delete key?**
Add key asks the path and the base text ("Add another" keeps the dialog open);
rename shows the current path read-only; delete names the translations lost
and offers Undo in the toast (re-writes the values the client still holds).

**Q5.7 Modules workspace?**
Read-only strip explaining where the keys come from; every row has a visible
Override button and an "Overridden" badge when the project files already
redefine it (new `overridden` flag on the rows of `GET /flat` for the modules
workspace). Override switches to Project files, says so in a toast and opens
the drawer on that key.

**Q5.8 Read-only server (`editable: false`)?**
A banner says so before anyone types, with the config to change; cells render
as text (L-03).

**Q5.9 Export?**
"Export" downloads the matrix of the workspace as CSV (key + one column per
language), generated in the browser.

**Q5.10 Is a project key with a module value "missing"?**
No. In the project files, a key an installed module already translates shows
the module's text: it is counted as translated, drawn dimmed with "From a
module", and kept out of Missing, of the coverage, of the queue and of the nav
badge. Before, the coverage counted it as present while the missing count did
not, so the two figures disagreed.

## 6. Language page

**Q6.1 What is the queue?**
One key at a time with the base text, the other translations for context, the
placeholder check, Previous, Skip, Save & next (⌘/Ctrl+Enter), an "Up next"
list and progress (L-04). Modes: Missing, Placeholder issues, All.

**Q6.2 Side panel?**
Coverage ring (translated / missing / placeholder issues) and a per-namespace
breakdown that scopes the queue when clicked.

**Q6.3 Page actions?**
Open in matrix, Download `<code>.json` (the language's messages, from a new
route), overflow with Make base and Remove (typed-code confirmation, L-02).

## 7. Workspaces and workspace settings

**Q7.1 Data for the cards?**
A new `GET /api/lang/translations/summary` returns every workspace with its
locales, key count, per-locale coverage and missing counts, and the override
count of the project files: one request instead of one `/flat` per workspace.

**Q7.2 Workspace settings?**
`DmsSection` + `DmsFieldRow` rows: name (with Rename…), base language (select,
saved instantly), languages (coverage bars, overflow per language, Add
language), "Use in your app" with i18next / fetch / curl snippets, danger zone
(rename, delete). The About card is a `DmsKeyValueList`.

**Q7.3 Delete and rename confirmations?**
Through `useConfirm`: impact list (files, translated strings), typed name to
confirm, and a "Download backup" route returning every language of the
workspace as one JSON file. The mockup's "12.4k requests in the last 7 days"
needs persisted request metrics: not implemented, the impact list omits it.

**Q7.4 Rename validation?**
Live: "Available" / "already exists" / invalid characters, and a before/after
URL preview (L-13).

**Q7.5 Language picker?**
Searchable list built from `Intl.DisplayNames` (native names), languages
already in the workspace shown disabled, and any BCP 47 code typed in the
search can be added (L-13). Flags are no longer stored for new languages.

## 8. Bugs found and fixed

In the existing module:

- Coverage and missing counts disagreed on the project files: the coverage
  counted a module's value as present, the missing count did not (Q5.10).
- With `editable: false`, every cell looked editable and each blur answered
  403 (L-03): cells are text and a banner says why.
- Hiding a language column silently changed the Missing count and filter
  (L-07): "Missing in" is now independent of the shown columns.
- `useWorkspaceFlat` started every page from one shared `EMPTY_FLAT` object and
  a save mutated rows in place: rows are copied before a local update.
- Renaming a workspace to its own name answered 409: the dialog disables
  Rename until the name changes.
- The add-language select listed languages already in the workspace and
  refused regional codes such as `pt-BR` (L-13).
- Overriding a module key switched workspace without a word (L-10).

Seen while testing, outside this repository: when the playground's
`antelope.config.ts` changes, `ajs project dev` restarts in-process and every
module calling `RegisterModule` fails with `Module "lang" is already
registered` (the module root registry of interface-dms survives the restart).
A source change reloads fine; only the config restart is affected.

## 9. Tests

- `pnpm test` (`ajs module test`, MongoDB in memory): 11 passing, including the
  new summary, export, `overridden` flag and action permission ids.
- `node --test tests/*.test.mjs`: the coverage, placeholder, namespace and
  fallback helpers of the frontend.
- `pnpm test:frontend` (`ajs dms verify-source`): client, SSR and e-mail
  bundles build and the layer type-checks against the DMS 0.6 layer.
- Playground in Chromium (Playwright), light, dark, French and 390 px: every
  page, the scope switch, add / remove / make base language, cell edit with
  save, Escape and Tab, `N` for next missing, key drawer with placeholder fix,
  add / rename / delete key with Undo, CSV export, the queue (save & next,
  skip, namespace scope, base and unknown language), create / rename / delete
  workspace with typed confirmation, the module key override, the command
  palette `?action=` entries and the read-only server.

## 10. Update to DMS 0.7.1

**Q10.1 Which versions?**
`@antelopejs/dms` `>=0.7.1 <0.8.0` (0.7.0 required an unreleased interface
and does not start), `@antelopejs/interface-dms` `>=0.5.0 <1.0.0`,
`@antelopejs/dms-frontend` 0.5.1, `@antelopejs/core` 1.14.0.

**Q10.2 What breaks?**
Nothing the module uses: permissions now need their ancestors (#172), which
the owner-only module already holds through `*`; the settings changes and the
notification bell do not touch it.

**Q10.3 What can now be a DMS block instead of a custom component?**
Blocks resolve `{{params.X}}` / `{{query.X}}` in their `fetchUrl` (#170) and
write composed texts with typed, pluralised params (#173). Since every page
keeps the workspace in `?workspace=`, three sections become stock blocks fed
by new routes:
- Overview KPIs: `StatGroup` on `GET /kpis?workspace=` (was `OverviewKpis`);
- Language progress: `StatGroup` on `GET /locale-stats?workspace=&locale=`
  (was the `LanguageProgress` ring);
- Workspace "About": `KeyValueList` on `GET /about?workspace=` (was
  `WorkspaceAbout`).
The scope bar adds `?workspace=` when a page opens without it, and every save
calls `refreshPageBlocks()` so these blocks follow the edits.

**Q10.4 Why not the languages list?**
`TableView.fromSource` does not resolve route tokens in its `fetchUrl` (only
blocks do), so a table cannot follow the selected workspace. It is the first
DMS addition proposed in `pdf/dms-lang-v2-ecrans.pdf`, with a copy button on
`KeyValueList`, a heatmap chart, a module context selector and an action row.

**Q10.5 The side panels (#168) and the ⌘K assistant (#169)?**
Not used: the key drawer belongs to the matrix, and the module has no
assistant.
