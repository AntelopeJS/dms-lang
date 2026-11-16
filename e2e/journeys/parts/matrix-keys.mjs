import { clickUntil, fieldValue, freshId, lang, pick, readLocaleFile, seedWorkspace } from "../../lang.mjs";
import { dragButton, gridOrder } from "../../files.mjs";

/** @typedef {import("../../lang.mjs").Ctx} Ctx */

/**
 * @param {Ctx} ctx The journey
 * @returns {Promise<string>} A workspace of three keys with only their English text, in English, German and French
 */
async function bareKeys(ctx) {
  const id = freshId(ctx, "keys");
  await seedWorkspace(ctx, id, { locales: ["en", "fr", "de"], keys: { "a.one": { en: "One" }, "a.two": { en: "Two" }, "a.three": { en: "Three" } } });
  return id;
}

const LANGUAGES = ["English", "Deutsch", "Français"];

/** Keyboard in a matrix cell, the missing-translation keys, the column order and the Add key dialog. */
export const keyJourneys = [
  {
    id: "cell-shortcuts",
    title: "in a cell Ctrl Enter saves and leaves it, Tab saves and edits the next cell, Shift Tab goes back, Ctrl Shift Enter opens the key panel with the typed text",
    entryPoint: "/modules/lang/translations > a cell",
    async run(/** @type {Ctx} */ ctx) {
      const id = await bareKeys(ctx);
      const tab = await ctx.tab("admin");
      await tab.signIn("admin");
      await tab.goto(`/modules/lang/translations?workspace=${id}`);
      await tab.click({ role: "button", name: "Translate a.one into Français" });
      await tab.fill({ role: "textbox", name: "Translate a.one into Français" }, "Un");
      await tab.press("Control+Enter", { role: "textbox", name: "Translate a.one into Français" });
      const stored = await lang(ctx, "read the first key", "GET", `/row?workspace=${id}&key=a.one`);
      await ctx.verify("Ctrl Enter saves the text and the cell stops editing", [
        ctx.equal("values", pick(stored.body, "row", "values"), { en: "One", fr: "Un" }),
        tab.visible({ role: "textbox", name: "Translate a.one into Français" }, { hidden: true }),
        tab.visible({ role: "textbox", name: "Translate a.two into Français" }, { hidden: true }),
      ]);
      await tab.goto(`/modules/lang/translations?workspace=${id}`);
      await tab.click({ role: "button", name: "Translate a.two into Français" });
      await tab.fill({ role: "textbox", name: "Translate a.two into Français" }, "Deux");
      await tab.press("Tab", { role: "textbox", name: "Translate a.two into Français" });
      const second = await lang(ctx, "read the second key", "GET", `/row?workspace=${id}&key=a.two`);
      await ctx.verify("Tab saves the cell and edits the next one (the next row's first language)", [
        ctx.equal("values", pick(second.body, "row", "values"), { en: "Two", fr: "Deux" }),
        tab.visible({ role: "textbox", name: "Translate a.three into Deutsch" }),
      ]);
      await tab.press("Shift+Tab", { role: "textbox", name: "Translate a.three into Deutsch" });
      await ctx.verify("Shift Tab edits the previous cell", [
        tab.visible({ role: "textbox", name: "Translate a.three into Deutsch" }, { hidden: true }),
        ctx.equal("the previous cell is open in an editor", await fieldValue(tab, { role: "textbox", name: "Edit a.two in Français" }), "Deux"),
      ]);
      await tab.goto(`/modules/lang/translations?workspace=${id}`);
      await tab.click({ role: "button", name: "Translate a.three into Deutsch" });
      await tab.fill({ role: "textbox", name: "Translate a.three into Deutsch" }, "Drei, pas encore enregistré");
      await tab.press("Control+Shift+Enter", { role: "textbox", name: "Translate a.three into Deutsch" });
      await ctx.verify("Ctrl Shift Enter opens the key in the panel with the text typed, saved nowhere yet", [
        tab.at(/^\/modules\/lang\/translations$/),
        tab.visible({ role: "heading", name: "a.three" }),
        ctx.equal("the panel field", await fieldValue(tab, { role: "textbox", name: "Deutsch" }), "Drei, pas encore enregistré"),
        ctx.equal("nothing written", pick((await lang(ctx, "read the third key", "GET", `/row?workspace=${id}&key=a.three`)).body, "row", "values"), { en: "Three" }),
      ]);
    },
  },
  {
    id: "n-and-shift-n-edit-missing-translations",
    title: "outside a field N edits the next missing translation and Shift N the previous one",
    entryPoint: "/modules/lang/translations > N",
    async run(/** @type {Ctx} */ ctx) {
      const id = await bareKeys(ctx);
      const tab = await ctx.tab("admin");
      await tab.signIn("admin");
      await tab.goto(`/modules/lang/translations?workspace=${id}`);
      await tab.press("n");
      await ctx.verify("N edits the first missing translation", [tab.visible({ role: "textbox", name: "Translate a.one into Deutsch" })]);
      await tab.press("Escape");
      await ctx.verify("Escape closes the editor", [tab.visible({ role: "textbox", name: /^Translate a\.\w+ into (Deutsch|Français)$/ }, { hidden: true })]);
      await tab.press("n");
      await ctx.verify("N again edits the next missing one (the next language of the same key)", [tab.visible({ role: "textbox", name: "Translate a.one into Français" })]);
      await tab.press("Escape");
      await ctx.verify("Escape closes the editor again", [tab.visible({ role: "textbox", name: /^Translate a\.\w+ into (Deutsch|Français)$/ }, { hidden: true })]);
      await tab.press("Shift+N");
      await ctx.verify("Shift N edits the previous missing translation", [tab.visible({ role: "textbox", name: "Translate a.one into Deutsch" })]);
    },
  },
  {
    id: "dragging-a-language-reorders-the-columns",
    title: "the Languages menu lists the columns with a drag handle each, and dragging a language moves its column",
    entryPoint: "/modules/lang/translations > Languages",
    async run(/** @type {Ctx} */ ctx) {
      const id = await bareKeys(ctx);
      const tab = await ctx.tab("admin");
      await tab.signIn("admin");
      await tab.goto(`/modules/lang/translations?workspace=${id}`);
      const before = await gridOrder(tab, LANGUAGES);
      await clickUntil(tab, { role: "button", name: /^Languages \d+\/\d+$/ }, { role: "dialog", name: /^Languages/ });
      await ctx.verify("the menu names every column and a handle to reorder it", [
        tab.visible({ role: "button", name: "Reorder Français" }),
        tab.visible({ role: "button", name: "Reorder Deutsch" }),
        ctx.equal("columns before", before, "Key|English|Deutsch|Français"),
      ]);
      await dragButton(tab, "Reorder Français", "Reorder Deutsch");
      await ctx.verify("French now comes before German", [ctx.equal("columns after", await gridOrder(tab, LANGUAGES), "Key|English|Français|Deutsch")]);
    },
  },
  {
    id: "add-key-shows-three-languages",
    title: "Add key shows three languages, the base first, and Show n more languages opens the others",
    entryPoint: "/modules/lang/translations?action=add-key",
    async run(/** @type {Ctx} */ ctx) {
      const id = freshId(ctx, "five");
      await seedWorkspace(ctx, id, { locales: ["en", "fr", "de", "es", "it"] });
      const tab = await ctx.tab("admin");
      await tab.signIn("admin");
      await tab.goto(`/modules/lang/translations?workspace=${id}&action=add-key`);
      await ctx.verify("three fields, English first, and the others behind a button", [
        tab.visible({ role: "textbox", name: "English en base" }),
        tab.visible({ role: "textbox", name: "Deutsch de" }),
        tab.visible({ role: "textbox", name: "Español es" }),
        tab.visible({ role: "textbox", name: "Français fr" }, { hidden: true }),
        tab.visible({ role: "textbox", name: "Italiano it" }, { hidden: true }),
        tab.visible({ role: "button", name: "Show 2 more languages" }),
      ]);
      await tab.click({ role: "button", name: "Show 2 more languages" });
      await ctx.verify("the others appear", [
        tab.visible({ role: "textbox", name: "Français fr" }),
        tab.visible({ role: "textbox", name: "Italiano it" }),
        tab.visible({ role: "button", name: /^Show \d+ more languages$/ }, { hidden: true }),
      ]);
      await tab.fill({ role: "textbox", name: "Key path" }, "only.french");
      await tab.fill({ role: "textbox", name: "Français fr" }, "Seulement");
      await tab.click({ role: "button", name: "Add key", exact: true });
      const added = await lang(ctx, "read the key", "GET", `/row?workspace=${id}&key=only.french`);
      await ctx.verify("a text in one language is enough", [ctx.equal("values", pick(added.body, "row", "values"), { fr: "Seulement" }), ctx.equal("file", readLocaleFile(ctx, id, "fr"), { only: { french: "Seulement" } })]);
    },
  },
];
