import { join } from "node:path";
import { panelJourneys } from "./parts/matrix-panel.mjs";
import { incompleteTab, viewJourneys } from "./parts/matrix-view.mjs";
import { freshId, guarded, lang, pick, projectLocalesDir, readJsonFile, readLocaleFile, resetProjectFiles, seedWorkspace, workspaceFiles } from "../lang.mjs";

/** @typedef {import("../lang.mjs").Ctx} Ctx */

/**
 * A workspace of three keys: one complete, one missing in French, one whose French changes a placeholder.
 *
 * @param {Ctx} ctx The journey
 * @returns {Promise<string>} The workspace id
 */
async function matrixWorkspace(ctx) {
  const id = freshId(ctx, "matrix");
  await seedWorkspace(ctx, id, {
    locales: ["en", "fr"],
    keys: {
      "shop.title": { en: "Shop", fr: "Boutique" },
      "shop.pay": { en: "Pay {price}" },
      "auth.login": { en: "Hello {name}", fr: "Salut {nom}" },
    },
  });
  return id;
}

/** The translation matrix: every key as a row, every language as a column. */
export const journeys = guarded([
  {
    id: "edit-a-cell-saves-and-moves-on",
    title: "a click edits a cell in place, Enter saves it and moves to the next row, Escape cancels",
    entryPoint: "/modules/lang/translations > a cell",
    async run(/** @type {Ctx} */ ctx) {
      const id = freshId(ctx, "cells");
      await seedWorkspace(ctx, id, { locales: ["en", "fr"], keys: { "a.one": { en: "One" }, "a.two": { en: "Two" } } });
      const tab = await ctx.tab("admin");
      await tab.signIn("admin");
      await tab.goto(`/modules/lang/translations?workspace=${id}`);
      await tab.click({ role: "button", name: "Translate a.one into Français" });
      await tab.fill({ role: "textbox", name: "Translate a.one into Français" }, "Un");
      await tab.press("Enter", { role: "textbox", name: "Translate a.one into Français" });
      await ctx.verify("Enter saves the cell and opens the next row for editing", [
        tab.visible({ role: "button", name: "Un" }),
        tab.visible({ role: "textbox", name: "Translate a.two into Français" }),
      ]);
      const saved = await lang(ctx, "read the key", "GET", `/row?workspace=${id}&key=a.one`);
      await ctx.verify("the first text is stored", [ctx.equal("values", pick(saved.body, "row", "values"), { en: "One", fr: "Un" }), ctx.equal("file", readLocaleFile(ctx, id, "fr"), { a: { one: "Un" } })]);
      await tab.fill({ role: "textbox", name: "Translate a.two into Français" }, "Deux, pas encore");
      await tab.press("Escape", { role: "textbox", name: "Translate a.two into Français" });
      const cancelled = await lang(ctx, "read the second key", "GET", `/row?workspace=${id}&key=a.two`);
      await ctx.verify("Escape leaves the cell as it was", [
        ctx.equal("values", pick(cancelled.body, "row", "values"), { en: "Two" }),
        tab.visible({ role: "button", name: "Translate a.two into Français" }),
      ]);
    },
  },
  {
    id: "status-tabs-search-and-namespace",
    title: "the status tabs count All, Missing, Complete and Issues, and the tabs, the namespace filter and the search narrow the rows",
    entryPoint: "/modules/lang/translations toolbar",
    async run(/** @type {Ctx} */ ctx) {
      const id = await matrixWorkspace(ctx);
      const tab = await ctx.tab("admin");
      await tab.signIn("admin");
      await tab.goto(`/modules/lang/translations?workspace=${id}`);
      await ctx.verify("the tabs count the keys", [
        tab.visible({ role: "radio", name: "All 3" }),
        tab.visible({ role: "radio", name: incompleteTab(1) }),
        tab.visible({ role: "radio", name: "Complete 2" }),
        tab.visible({ role: "radio", name: "Issues 1" }),
        tab.visible({ role: "button", name: "Open shop.title in the panel" }),
        tab.visible({ role: "button", name: "Open auth.login in the panel" }),
      ]);
      await tab.click({ role: "radio", name: incompleteTab(1) });
      await ctx.verify("Missing keeps the key French lacks", [
        tab.visible({ role: "button", name: "Open shop.pay in the panel" }),
        tab.visible({ role: "button", name: "Open shop.title in the panel" }, { hidden: true }),
        tab.visible({ role: "button", name: "Open auth.login in the panel" }, { hidden: true }),
      ]);
      await tab.click({ role: "radio", name: "Issues 1" });
      await ctx.verify("Issues keeps the key whose placeholders differ from the base text", [
        tab.visible({ role: "button", name: "Open auth.login in the panel" }),
        tab.visible({ role: "button", name: "Open shop.pay in the panel" }, { hidden: true }),
        tab.shows(/\{nom\} is not in the base text/),
      ]);
      await tab.click({ role: "radio", name: "All 3" });
      await tab.click({ role: "textbox", name: "Search keys and text" });
      await tab.fill({ role: "textbox", name: "Search keys and text" }, "Boutique");
      await ctx.verify("the search matches texts as well as key paths", [
        tab.visible({ role: "button", name: "Open shop.title in the panel" }),
        tab.visible({ role: "button", name: "Open shop.pay in the panel" }, { hidden: true }),
        tab.visible({ role: "button", name: "Open auth.login in the panel" }, { hidden: true }),
      ]);
      await tab.goto(`/modules/lang/translations?workspace=${id}&filter=missing`);
      await ctx.verify("the filter=missing link opens the incomplete keys", [
        tab.visible({ role: "button", name: "Open shop.pay in the panel" }),
        tab.visible({ role: "button", name: "Open shop.title in the panel" }, { hidden: true }),
      ]);
    },
  },
  {
    id: "key-panel-edits-every-language",
    title: "the key panel shows every language with the base text as reference, saves them in one request, and the open key is in the URL",
    entryPoint: "/modules/lang/translations?key=",
    async run(/** @type {Ctx} */ ctx) {
      const id = await matrixWorkspace(ctx);
      const tab = await ctx.tab("admin");
      await tab.signIn("admin");
      await tab.goto(`/modules/lang/translations?workspace=${id}`);
      await tab.click({ role: "button", name: "Open shop.pay in the panel" });
      await ctx.verify("the panel opens on the key, shows its variables and the position among the keys", [
        tab.visible({ role: "dialog", name: "shop.pay" }),
        tab.shows(/2 of 3/),
        tab.shows(/Variables/),
        tab.visible({ role: "textbox", name: "English" }),
        tab.visible({ role: "textbox", name: "Français" }),
      ]);
      await tab.fill({ role: "textbox", name: "English" }, "Pay now {price}");
      await tab.fill({ role: "textbox", name: "Français" }, "Payer {price}");
      await tab.click({ role: "button", name: "Save", exact: true });
      const saved = await lang(ctx, "read the key", "GET", `/row?workspace=${id}&key=shop.pay`);
      await ctx.verify("Save writes both languages", [ctx.equal("values", pick(saved.body, "row", "values"), { en: "Pay now {price}", fr: "Payer {price}" })]);
      await tab.reload();
      await ctx.verify("a reload opens the same key again", [tab.visible({ role: "dialog", name: "shop.pay" }), tab.visible({ role: "textbox", name: "Français" })]);
    },
  },
  {
    id: "add-key-dialog",
    title: "Add key asks the path and the base text, keeps the dialog open for Add another, and adds the key to every file",
    entryPoint: "/modules/lang/translations?action=add-key",
    async run(/** @type {Ctx} */ ctx) {
      const id = freshId(ctx, "addkey");
      await seedWorkspace(ctx, id, { locales: ["en", "fr"] });
      const tab = await ctx.tab("admin");
      await tab.signIn("admin");
      await tab.goto(`/modules/lang/translations?workspace=${id}&action=add-key`);
      await ctx.verify("the dialog asks for the path and one text per language and cannot be submitted empty", [
        tab.visible({ role: "dialog", name: "Add key" }),
        tab.visible({ role: "textbox", name: "Key path" }),
        tab.visible({ role: "textbox", name: "English en base" }),
        tab.visible({ role: "textbox", name: "Français fr" }),
        tab.enabled({ role: "button", name: "Add key", exact: true }, { disabled: true }),
      ]);
      await tab.fill({ role: "textbox", name: "Key path" }, "cart.title");
      await tab.fill({ role: "textbox", name: "English en base" }, "Your cart");
      await tab.fill({ role: "textbox", name: "Français fr" }, "Votre panier");
      await tab.check({ role: "checkbox", name: "Add another" });
      await tab.click({ role: "button", name: "Add key", exact: true });
      await ctx.verify("Add another keeps the dialog open and empty", [tab.visible({ role: "dialog", name: "Add key" }), tab.shows(/Key cart\.title added/)]);
      await tab.fill({ role: "textbox", name: "Key path" }, "cart.empty");
      await tab.fill({ role: "textbox", name: "English en base" }, "Nothing here");
      await tab.click({ role: "button", name: "Add key", exact: true });
      const flat = await lang(ctx, "read the keys", "GET", `/flat?workspace=${id}`);
      await ctx.verify("both keys are stored, in the base language's file and in French", [
        ctx.equal("English file", readLocaleFile(ctx, id, "en"), { cart: { title: "Your cart", empty: "Nothing here" } }),
        ctx.equal("French file", readLocaleFile(ctx, id, "fr"), { cart: { title: "Votre panier" } }),
        ctx.equal("missing in French", pick(flat.body, "localeMissing"), { en: 0, fr: 1 }),
        ctx.equal("files", workspaceFiles(ctx, id), [".workspace.json", "en.json", "fr.json"]),
      ]);
    },
  },
  {
    id: "delete-key-offers-undo",
    title: "Delete asks first, removes the key from every language, and the toast's Undo brings it back",
    entryPoint: "/modules/lang/translations > key panel > Delete",
    async run(/** @type {Ctx} */ ctx) {
      const id = await matrixWorkspace(ctx);
      const tab = await ctx.tab("admin");
      await tab.signIn("admin");
      await tab.goto(`/modules/lang/translations?workspace=${id}&key=shop.title`);
      await tab.click({ role: "button", name: "Delete" });
      await ctx.verify("the dialog names the key and the workspace", [tab.visible({ role: "dialog", name: "Delete shop.title?" }), tab.shows(/its 2 translations \(en, fr\) are removed from every file of/)]);
      await tab.click({ role: "button", name: "Delete key" });
      const gone = await lang(ctx, "read the key", "GET", `/row?workspace=${id}&key=shop.title`);
      await ctx.verify("the key is gone from both languages and the toast offers Undo", [
        ctx.equal("row", pick(gone.body, "row"), undefined),
        ctx.equal("files", [pick(readLocaleFile(ctx, id, "en"), "shop", "title"), pick(readLocaleFile(ctx, id, "fr"), "shop", "title")], [undefined, undefined]),
        tab.visible({ role: "button", name: "Undo" }),
      ]);
      await tab.click({ role: "button", name: "Undo" });
      const back = await lang(ctx, "read the key again", "GET", `/row?workspace=${id}&key=shop.title`);
      await ctx.verify("Undo restores every language's text", [ctx.equal("values", pick(back.body, "row", "values"), { en: "Shop", fr: "Boutique" })]);
    },
  },
  {
    id: "export-menu-counts-the-view",
    title: "Export offers the filtered view and the whole workspace, each with its key and language counts",
    entryPoint: "/modules/lang/translations > Export",
    async run(/** @type {Ctx} */ ctx) {
      const id = await matrixWorkspace(ctx);
      const tab = await ctx.tab("admin");
      await tab.signIn("admin");
      await tab.goto(`/modules/lang/translations?workspace=${id}`);
      await tab.click({ role: "button", name: "Export" });
      await ctx.verify("with no filter both entries cover everything", [
        tab.visible({ role: "menuitem", name: "This view · 3 keys, 2 languages" }),
        tab.visible({ role: "menuitem", name: "Everything · 3 keys, 2 languages" }),
      ]);
      await tab.press("Escape");
      await tab.click({ role: "radio", name: incompleteTab(1) });
      await tab.click({ role: "button", name: "Export" });
      await ctx.verify("a filter narrows the view and not the whole workspace", [
        tab.visible({ role: "menuitem", name: "This view · 1 key, 2 languages" }),
        tab.visible({ role: "menuitem", name: "Everything · 3 keys, 2 languages" }),
      ]);
    },
  },
  {
    id: "override-a-module-key-from-the-matrix",
    title: "an installed module's key opens read-only with Override, which moves to the project files where saving a French text overrides it",
    entryPoint: "/modules/lang/translations?workspace=modules&key=dms.button.save_changes",
    async run(/** @type {Ctx} */ ctx) {
      resetProjectFiles(ctx);
      const tab = await ctx.tab("admin");
      await tab.signIn("admin");
      await tab.goto("/modules/lang/translations?workspace=modules&key=dms.button.save_changes");
      await ctx.verify("the panel shows the module's texts and no editor", [
        tab.shows(/Enregistrer les modifications/),
        tab.visible({ role: "button", name: "Override" }),
        tab.visible({ role: "textbox", name: "Français"  }, { hidden: true }),
      ]);
      await tab.click({ role: "button", name: "Override" });
      await ctx.verify("the same key opens in the project files, marked as from a module", [tab.shows(/From a module/), tab.visible({ role: "textbox", name: "Français" })]);
      await tab.fill({ role: "textbox", name: "Français" }, "Enregistrer mes changements");
      await tab.click({ role: "button", name: "Save", exact: true });
      const row = await lang(ctx, "read the key", "GET", "/row?workspace=default&key=dms.button.save_changes");
      await ctx.verify("the override is written to the project's French file and the module keeps its text", [
        ctx.equal("values", pick(row.body, "row", "values"), { fr: "Enregistrer mes changements" }),
        ctx.equal("inherited", pick(row.body, "row", "inherited"), { en: "Save changes", fr: "Enregistrer les modifications" }),
        ctx.equal("file", pick(readJsonFile(join(projectLocalesDir(ctx), "app-fr-FR.json")), "dms", "button", "save_changes"), "Enregistrer mes changements"),
      ]);
      await tab.goto("/modules/lang/translations?workspace=modules");
      await tab.fill({ role: "textbox", name: "Search keys and text" }, "dms.button.save_changes");
      await ctx.verify("back in the installed modules, the row carries the Overridden badge", [tab.visible({ role: "button", name: "Open dms.button.save_changes in the panel" }), tab.shows(/Overridden/)]);
      resetProjectFiles(ctx);
    },
  },
  {
    id: "language-and-namespace-filters",
    title: "Translate into keeps the rows missing in one language and Namespace restricts the rows to one namespace",
    entryPoint: "/modules/lang/translations toolbar",
    async run(/** @type {Ctx} */ ctx) {
      const id = freshId(ctx, "filters");
      await seedWorkspace(ctx, id, {
        locales: ["en", "fr", "de"],
        keys: { "shop.title": { en: "Shop", fr: "Boutique" }, "shop.pay": { en: "Pay", de: "Zahle" }, "auth.login": { en: "In", fr: "Entrer", de: "Rein" } },
      });
      const tab = await ctx.tab("admin");
      await tab.signIn("admin");
      await tab.goto(`/modules/lang/translations?workspace=${id}&filter=missing&missingIn=de`);
      await ctx.verify("only the key German lacks", [tab.visible({ role: "button", name: "Open shop.title in the panel" }), tab.visible({ role: "button", name: "Open shop.pay in the panel" }, { hidden: true }), tab.visible({ role: "button", name: "Open auth.login in the panel" }, { hidden: true })]);
      await tab.goto(`/modules/lang/translations?workspace=${id}&filter=missing&missingIn=fr`);
      await ctx.verify("only the key French lacks", [tab.visible({ role: "button", name: "Open shop.pay in the panel" }), tab.visible({ role: "button", name: "Open shop.title in the panel" }, { hidden: true })]);
      await tab.goto(`/modules/lang/translations?workspace=${id}&namespace=auth`);
      await ctx.verify("one namespace", [tab.visible({ role: "button", name: "Open auth.login in the panel" }), tab.visible({ role: "button", name: "Open shop.title in the panel" }, { hidden: true }), tab.visible({ role: "button", name: "Open shop.pay in the panel" }, { hidden: true })]);
    },
  },
  {
    id: "key-panel-renames-and-closing-saves",
    title: "Rename in the key panel moves the key, and closing the panel saves the languages that changed",
    entryPoint: "/modules/lang/translations?key=",
    async run(/** @type {Ctx} */ ctx) {
      const id = await matrixWorkspace(ctx);
      const tab = await ctx.tab("admin");
      await tab.signIn("admin");
      await tab.goto(`/modules/lang/translations?workspace=${id}&key=shop.pay`);
      await tab.fill({ role: "textbox", name: "Français" }, "Payer {price}");
      await tab.click({ role: "button", name: "Close" });
      const saved = await lang(ctx, "read the key", "GET", `/row?workspace=${id}&key=shop.pay`);
      await ctx.verify("closing saved the changed language", [ctx.equal("values", pick(saved.body, "row", "values"), { en: "Pay {price}", fr: "Payer {price}" })]);
      await tab.goto(`/modules/lang/translations?workspace=${id}&key=shop.pay`);
      await tab.click({ role: "button", name: "Rename" });
      await tab.fill({ role: "textbox", name: "New path" }, "shop.checkout");
      await tab.click({ role: "button", name: "Rename key" });
      const moved = await lang(ctx, "read the new key", "GET", `/row?workspace=${id}&key=shop.checkout`);
      const old = await lang(ctx, "read the old key", "GET", `/row?workspace=${id}&key=shop.pay`);
      await ctx.verify("the key has its new path with both texts", [ctx.equal("new", pick(moved.body, "row", "values"), { en: "Pay {price}", fr: "Payer {price}" }), ctx.equal("old", pick(old.body, "row"), undefined)]);
    },
  },
  ...viewJourneys,
  ...panelJourneys,
]);
