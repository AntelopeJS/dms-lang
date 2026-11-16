import { currentUrl } from "../../files.mjs";
import { join } from "node:path";
import { clickUntil, fieldValue, freshId, lang, pick, projectLocalesDir, readJsonFile, resetProjectFiles, seedWorkspace } from "../../lang.mjs";

/** @typedef {import("../../lang.mjs").Ctx} Ctx */

/**
 * @param {Ctx} ctx The journey
 * @returns {Promise<string>} A workspace of two keys, French lacking both
 */
async function twoKeys(ctx) {
  const id = freshId(ctx, "pk");
  await seedWorkspace(ctx, id, { locales: ["en", "fr"], keys: { "a.one": { en: "One" }, "a.two": { en: "Two" }, "a.pay": { en: "Pay {price}" } } });
  return id;
}

/** What the key panel and a cell do on Ctrl Enter, Escape and blur, the filters of a deep link, and the module key panel. */
export const panelKeyJourneys = [
  {
    id: "ctrl-enter-in-the-panel-saves-and-opens-the-next-key",
    title: "Ctrl Enter in a key panel field saves the texts and opens the next key",
    entryPoint: "/modules/lang/translations?key=a.one",
    async run(/** @type {Ctx} */ ctx) {
      const id = await twoKeys(ctx);
      const tab = await ctx.tab("admin");
      await tab.signIn("admin");
      await tab.goto(`/modules/lang/translations?workspace=${id}&key=a.one`);
      await clickUntil(tab, { role: "textbox", name: "Français" }, { role: "heading", name: "a.one" });
      await tab.fill({ role: "textbox", name: "Français" }, "Un");
      await tab.press("Control+Enter", { role: "textbox", name: "Français" });
      const saved = await lang(ctx, "read the first key", "GET", `/row?workspace=${id}&key=a.one`);
      await ctx.verify("the text is stored and the next key is open", [ctx.equal("values", pick(saved.body, "row", "values"), { en: "One", fr: "Un" }), tab.visible({ role: "heading", name: "a.two" })]);
    },
  },
  {
    id: "escape-saves-and-closes-the-panel",
    title: "Escape in the key panel saves the changed language and closes it",
    entryPoint: "/modules/lang/translations?key=a.one",
    async run(/** @type {Ctx} */ ctx) {
      const id = await twoKeys(ctx);
      const tab = await ctx.tab("admin");
      await tab.signIn("admin");
      await tab.goto(`/modules/lang/translations?workspace=${id}&key=a.one`);
      await clickUntil(tab, { role: "textbox", name: "Français" }, { role: "heading", name: "a.one" });
      await tab.fill({ role: "textbox", name: "Français" }, "Un");
      await tab.press("Escape");
      await tab.press("Escape");
      const saved = await lang(ctx, "read the key", "GET", `/row?workspace=${id}&key=a.one`);
      await ctx.verify("the panel is closed and the text stored", [tab.visible({ role: "heading", name: "a.one" }, { hidden: true }), ctx.equal("values", pick(saved.body, "row", "values"), { en: "One", fr: "Un" })]);
    },
  },
  {
    id: "a-cell-saves-when-it-loses-focus",
    title: "a cell saves its text when it loses focus, and one that leaves out a placeholder offers Insert for it",
    entryPoint: "/modules/lang/translations > a cell",
    async run(/** @type {Ctx} */ ctx) {
      const id = await twoKeys(ctx);
      const tab = await ctx.tab("admin");
      await tab.signIn("admin");
      await tab.goto(`/modules/lang/translations?workspace=${id}`);
      await tab.click({ role: "button", name: "Translate a.one into Français" });
      await tab.fill({ role: "textbox", name: "Translate a.one into Français" }, "Un");
      await tab.click({ role: "heading", name: "Translation matrix" });
      const saved = await lang(ctx, "read the key", "GET", `/row?workspace=${id}&key=a.one`);
      await ctx.verify("leaving the cell saved it", [ctx.equal("values", pick(saved.body, "row", "values"), { en: "One", fr: "Un" })]);
      await tab.click({ role: "button", name: "Translate a.pay into Français" });
      await tab.fill({ role: "textbox", name: "Translate a.pay into Français" }, "Payer");
      await ctx.verify("the cell offers the placeholder it leaves out", [tab.visible({ role: "button", name: /Insert \{price\}/ })]);
      await tab.click({ role: "button", name: /Insert \{price\}/ });
      await ctx.verify("Insert puts it in the text", [ctx.holds("the cell text", /\{price\}/.test(String(await fieldValue(tab, { role: "textbox", name: /^(Translate|Edit) a\.pay (into|in) Français$/ }))), "no {price} in the cell")]);
    },
  },
  {
    id: "matrix-deep-links-filter-and-search",
    title: "?filter= keeps the complete, the issue or every key and ?q= searches the keys and the texts",
    entryPoint: "/modules/lang/translations?filter=&q=",
    async run(/** @type {Ctx} */ ctx) {
      const id = freshId(ctx, "links");
      await seedWorkspace(ctx, id, {
        locales: ["en", "fr"],
        keys: { "a.done": { en: "Done", fr: "Fini" }, "a.bad": { en: "Pay {price}", fr: "Payer {prix}" }, "a.gap": { en: "Gap" }, "b.search": { en: "Findme text", fr: "Trouvez" } },
      });
      const tab = await ctx.tab("admin");
      await tab.signIn("admin");
      const open = (/** @type {string} */ key) => ({ role: "button", name: `Open ${key} in the panel` });
      await tab.goto(`/modules/lang/translations?workspace=${id}&filter=complete`);
      await ctx.verify("filter=complete keeps the translated keys", [tab.visible(open("a.done")), tab.visible(open("b.search")), tab.visible(open("a.bad")), tab.visible(open("a.gap"), { hidden: true })]);
      await tab.goto(`/modules/lang/translations?workspace=${id}&filter=issues`);
      await ctx.verify("filter=issues keeps the key whose placeholders differ", [tab.visible(open("a.bad")), tab.visible(open("a.done"), { hidden: true }), tab.visible(open("a.gap"), { hidden: true })]);
      await tab.goto(`/modules/lang/translations?workspace=${id}&filter=all`);
      await ctx.verify("filter=all keeps every key", [tab.visible(open("a.done")), tab.visible(open("a.bad")), tab.visible(open("a.gap")), tab.visible(open("b.search"))]);
      await tab.goto(`/modules/lang/translations?workspace=${id}&q=Trouvez`);
      await ctx.verify("q= matches the text of any language and fills the search field", [
        tab.visible(open("b.search")),
        tab.visible(open("a.done"), { hidden: true }),
        ctx.equal("search field", await fieldValue(tab, { role: "textbox", name: "Search keys and text" }), "Trouvez"),
      ]);
    },
  },
  {
    id: "issues-tab-holds-keys-with-no-base-text",
    title: "the Issues tab keeps a key whose base text is missing, next to the keys with a translation to review",
    entryPoint: "/modules/lang/translations > Issues",
    async run(/** @type {Ctx} */ ctx) {
      const id = freshId(ctx, "nobase");
      await seedWorkspace(ctx, id, { locales: ["en", "fr"], keys: { "a.orphan": { fr: "Orpheline" }, "a.fine": { en: "Fine", fr: "Bien" }, "a.bad": { en: "Pay {price}", fr: "Payer" } } });
      const tab = await ctx.tab("admin");
      await tab.signIn("admin");
      await tab.goto(`/modules/lang/translations?workspace=${id}&filter=issues`);
      await ctx.verify("both the key with no base text and the key with a placeholder issue are listed", [
        tab.visible({ role: "button", name: "Open a.orphan in the panel" }),
        tab.visible({ role: "button", name: "Open a.bad in the panel" }),
        tab.visible({ role: "button", name: "Open a.fine in the panel" }, { hidden: true }),
      ]);
    },
  },
  {
    id: "overridden-key-offers-revert-to-the-module-text",
    title: "the panel of a key that overrides a module text offers Revert to module text in place of Delete, and hides Rename",
    entryPoint: "/modules/lang/translations?workspace=default&key=dms.button.save_changes",
    async run(/** @type {Ctx} */ ctx) {
      resetProjectFiles(ctx);
      const tab = await ctx.tab("admin");
      await tab.signIn("admin");
      await lang(ctx, "override the module text", "PUT", "/key", { workspace: "default", path: "dms.button.save_changes", values: { fr: "Enregistrer mes changements" } });
      await tab.goto("/modules/lang/translations?workspace=default&key=dms.button.save_changes");
      await ctx.verify("Revert to module text replaces Delete and Rename is hidden", [
        tab.visible({ role: "button", name: "Revert to module text" }),
        tab.visible({ role: "button", name: "Delete" }, { hidden: true }),
        tab.visible({ role: "button", name: "Rename" }, { hidden: true }),
      ]);
      await tab.click({ role: "button", name: "Revert to module text" });
      await ctx.verify("the dialog says what is removed", [tab.visible({ role: "dialog", name: /^Revert dms\.button\.save_changes to the module text\?/ }), tab.shows(/Your text \(fr\) is removed from the project files/)]);
      await tab.click({ role: "button", name: "Revert to module text", within: { role: "dialog", name: /^Revert / } });
      const reverted = await lang(ctx, "read the key", "GET", "/row?workspace=default&key=dms.button.save_changes");
      await ctx.verify("the project's own value is gone", [ctx.equal("file", pick(readJsonFile(join(projectLocalesDir(ctx), "app-fr-FR.json")), "dms", "button", "save_changes"), undefined), ctx.equal("the module text shows again", pick(reverted.body, "row", "values", "fr"), undefined)]);
      resetProjectFiles(ctx);
    },
  },
  {
    id: "override-from-the-row",
    title: "a row of the installed modules offers Override, which opens the key in the project files",
    entryPoint: "/modules/lang/translations?workspace=modules > Override",
    async run(/** @type {Ctx} */ ctx) {
      resetProjectFiles(ctx);
      const tab = await ctx.tab("admin");
      await tab.signIn("admin");
      await tab.goto("/modules/lang/translations?workspace=modules&q=dms.button.save_changes");
      await ctx.verify("the row is read-only: no cell editors, an Override button", [
        tab.visible({ role: "button", name: "Override dms.button.save_changes" }),
        tab.visible({ role: "button", name: /^Translate dms\.button\.save_changes into / }, { hidden: true }),
      ]);
      await tab.click({ role: "button", name: "Override dms.button.save_changes" });
      await ctx.verify("the key opens in the project files, marked as from a module", [
        ctx.holds("project files and the key", /workspace=default/.test(currentUrl(tab)) && /key=dms\.button\.save_changes/.test(currentUrl(tab)), currentUrl(tab)),
        tab.shows(/From a module/),
      ]);
      resetProjectFiles(ctx);
    },
  },
];
