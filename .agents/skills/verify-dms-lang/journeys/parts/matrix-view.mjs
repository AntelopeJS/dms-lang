import { chmodSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { freshId, lang, pick, resetProjectFiles, seedWorkspace, workspacesDir } from "../../lang.mjs";

/** @typedef {import("../../lang.mjs").Ctx} Ctx */

/**
 * The status tab of the rows missing a translation. The docs call it Incomplete; the dashboard names it Missing
 * when it counts a single language. Either name passes, so neither wording is pinned.
 *
 * @param {number} count The count the tab shows
 * @returns {RegExp} Its accessible name
 */
export function incompleteTab(count) {
  return new RegExp(`^(Incomplete|Missing) ${count}$`);
}

/** The language filter: "Missing in" in the docs, "Translate into" in the dashboard (dms-lang#90). */
const MISSING_IN = /^(Missing in|Translate into)$/;

/**
 * @param {Ctx} ctx The journey
 * @returns {Promise<string>} A workspace whose German lacks shop.title and French lacks shop.pay
 */
async function threeLanguages(ctx) {
  const id = freshId(ctx, "columns");
  await seedWorkspace(ctx, id, {
    locales: ["en", "fr", "de"],
    keys: { "shop.title": { en: "Shop", fr: "Boutique" }, "shop.pay": { en: "Pay", de: "Zahle" }, "auth.login": { en: "In", fr: "Entrer", de: "Rein" } },
  });
  return id;
}

/** The matrix's frame: the sidebar, the columns, the filters and the groups. */
export const viewJourneys = [
  {
    id: "sidebar-badge-counts-the-project-files",
    title: "the module sits under Modules > Translations with its Translate and Manage pages, and the matrix's sidebar badge counts the missing translations of the project files, whatever workspace is open",
    entryPoint: "/modules/lang sidebar",
    async run(/** @type {Ctx} */ ctx) {
      resetProjectFiles(ctx);
      const id = freshId(ctx, "badge");
      await seedWorkspace(ctx, id, { locales: ["en", "fr"], keys: { "a.one": { en: "One" }, "a.two": { en: "Two" } } });
      const tab = await ctx.tab("admin");
      await tab.signIn("admin");
      await tab.goto(`/modules/lang/translations?workspace=${id}`);
      await ctx.verify("the sidebar groups the five pages and the badge counts the project files' one gap, not this workspace's two", [
        tab.shows(/Translate\s*Overview\s*Translation matrix\s*1\s*Translation queue\s*Manage\s*Workspaces\s*Workspace settings/i),
        tab.visible({ role: "link", name: "Translation matrix 1", exact: true }),
        tab.visible({ role: "link", name: "Translations", exact: true, within: { role: "navigation", name: "Breadcrumb" } }),
      ]);
      await tab.click({ role: "link", name: "Translations", exact: true, within: { role: "navigation", name: "Breadcrumb" } });
      await ctx.verify("Modules > Translations opens the overview", [tab.at(/^\/modules\/lang\/overview$/)]);
      await lang(ctx, "translate the project files' missing key", "PUT", "/key", { workspace: "default", path: "shop.cancel", values: { fr: "Annuler la commande" } });
      await tab.reload();
      await ctx.verify("with nothing missing in the project files the badge is gone", [tab.visible({ role: "link", name: "Translation matrix", exact: true })]);
      resetProjectFiles(ctx);
    },
  },
  {
    id: "missing-in-and-the-language-columns",
    title: "each column header carries its missing count and a coverage bar, Languages chooses the columns, and the language filter keeps the rows missing in one language whatever columns are shown",
    entryPoint: "/modules/lang/translations toolbar",
    async run(/** @type {Ctx} */ ctx) {
      const id = await threeLanguages(ctx);
      const tab = await ctx.tab("admin");
      await tab.signIn("admin");
      await tab.goto(`/modules/lang/translations?workspace=${id}`);
      await ctx.verify("every language is a column with its missing count and a coverage bar", [
        tab.visible({ role: "gridcell", name: /^English base 100$/ }),
        tab.visible({ role: "gridcell", name: /^Deutsch 1 missing 66$/ }),
        tab.visible({ role: "gridcell", name: /^Français 1 missing 66$/ }),
        tab.count({ role: "meter" }, 3),
        tab.visible({ role: "button", name: "Languages 3/3" }),
      ]);
      await tab.click({ role: "radio", name: incompleteTab(2) });
      await ctx.verify("with every column shown, the incomplete rows are those missing in any language", [
        tab.visible({ role: "button", name: "Open shop.title in the panel" }),
        tab.visible({ role: "button", name: "Open shop.pay in the panel" }),
        tab.visible({ role: "button", name: "Open auth.login in the panel" }, { hidden: true }),
      ]);
      await tab.click({ role: "button", name: "Languages 3/3" });
      await tab.click({ role: "checkbox", name: "Deutsch" });
      await tab.press("Escape");
      await ctx.verify("Languages hides the German column", [
        tab.visible({ role: "gridcell", name: /^Deutsch/ }, { hidden: true }),
        tab.visible({ role: "gridcell", name: /^Français 1 missing/ }),
        tab.count({ role: "meter" }, 2),
        tab.visible({ role: "button", name: "Languages 2/3" }),
      ]);
      await tab.click({ role: "combobox", name: MISSING_IN });
      await tab.click({ role: "option", name: /^Deutsch/ });
      await ctx.verify("German still filters the rows although its column was hidden", [
        tab.visible({ role: "button", name: "Open shop.title in the panel" }),
        tab.visible({ role: "button", name: "Open shop.pay in the panel" }, { hidden: true }),
        tab.visible({ role: "button", name: "Open auth.login in the panel" }, { hidden: true }),
      ]);
    },
  },
  {
    id: "groups-collapse-and-stay-as-they-were",
    title: "rows are grouped by namespace, a group collapses and opens again, and closing the key panel leaves the groups as they were",
    entryPoint: "/modules/lang/translations > a namespace group",
    async run(/** @type {Ctx} */ ctx) {
      const id = await threeLanguages(ctx);
      const tab = await ctx.tab("admin");
      await tab.signIn("admin");
      await tab.goto(`/modules/lang/translations?workspace=${id}`);
      await ctx.verify("one group per namespace, with its key count", [tab.visible({ role: "button", name: /^shop 2 keys/ }), tab.visible({ role: "button", name: /^auth 1 key/ })]);
      await tab.click({ role: "button", name: /^shop 2 keys/ });
      await ctx.verify("the shop group collapses and auth stays open", [
        tab.visible({ role: "button", name: "Open shop.title in the panel" }, { hidden: true }),
        tab.visible({ role: "button", name: "Open shop.pay in the panel" }, { hidden: true }),
        tab.visible({ role: "button", name: "Open auth.login in the panel" }),
      ]);
      await tab.click({ role: "button", name: "Open auth.login in the panel" });
      await tab.click({ role: "button", name: "Close" });
      await ctx.verify("closing the panel leaves shop collapsed and auth open", [
        tab.visible({ role: "dialog", name: "auth.login" }, { hidden: true }),
        tab.visible({ role: "button", name: "Open shop.title in the panel" }, { hidden: true }),
        tab.visible({ role: "button", name: "Open auth.login in the panel" }),
      ]);
      await tab.click({ role: "button", name: /^shop 2 keys/ });
      await ctx.verify("the group opens again", [tab.visible({ role: "button", name: "Open shop.title in the panel" }), tab.visible({ role: "button", name: "Open shop.pay in the panel" })]);
    },
  },
  {
    id: "cell-line-break-and-failed-save",
    title: "Shift Enter adds a line break without saving, and a cell whose save fails says Not saved, keeps the text and saves it on Retry",
    entryPoint: "/modules/lang/translations > a cell",
    async run(/** @type {Ctx} */ ctx) {
      const id = freshId(ctx, "cellstate");
      await seedWorkspace(ctx, id, { locales: ["en", "fr"], keys: { "a.note": { en: "Note" }, "a.title": { en: "Title" } } });
      const tab = await ctx.tab("admin");
      await tab.signIn("admin");
      await tab.goto(`/modules/lang/translations?workspace=${id}`);
      const note = { role: "textbox", name: "Translate a.note into Français" };
      await tab.click({ role: "button", name: "Translate a.note into Français" });
      await tab.fill(note, "Ligne un");
      await tab.press("End", note);
      await tab.press("Shift+Enter", note);
      const open = await lang(ctx, "read the key while the cell is open", "GET", `/row?workspace=${id}&key=a.note`);
      await ctx.verify("Shift Enter breaks the line and keeps the cell open", [
        tab.visible(note),
        ctx.equal("the cell's text", await tab.value(note), "Ligne un\n"),
        ctx.equal("nothing saved yet", pick(open.body, "row", "values"), { en: "Note" }),
      ]);
      await tab.press("Enter", note);
      const saved = await lang(ctx, "read the key", "GET", `/row?workspace=${id}&key=a.note`);
      await ctx.verify("Enter saves the text with its line break and opens the next row", [
        ctx.equal("values", pick(saved.body, "row", "values"), { en: "Note", fr: "Ligne un\n" }),
        tab.visible({ role: "textbox", name: "Translate a.title into Français" }),
      ]);
      const french = join(workspacesDir(ctx, id), "fr.json");
      const before = readFileSync(french, "utf8");
      const cell = { role: "gridcell", name: /^Translate a\.title into Français Not saved/ };
      chmodSync(french, 0o444);
      try {
        await tab.fill({ role: "textbox", name: "Translate a.title into Français" }, "Titre");
        await tab.press("Enter", { role: "textbox", name: "Translate a.title into Français" });
        await ctx.verify("the failed save says so, offers Retry and keeps the text", [
          tab.visible(cell),
          tab.visible({ role: "button", name: "Retry", within: cell }),
          tab.visible({ role: "button", name: "Translate a.title into Français", within: cell }),
          tab.shows(/Titre/),
          ctx.equal("the file is untouched", readFileSync(french, "utf8"), before),
        ]);
      } finally {
        chmodSync(french, 0o600);
      }
      await tab.click({ role: "button", name: "Retry", within: cell });
      const retried = await lang(ctx, "read the key after Retry", "GET", `/row?workspace=${id}&key=a.title`);
      await ctx.verify("Retry saves the kept text", [ctx.equal("values", pick(retried.body, "row", "values"), { en: "Title", fr: "Titre" }), tab.visible(cell, { hidden: true })]);
    },
  },
];
