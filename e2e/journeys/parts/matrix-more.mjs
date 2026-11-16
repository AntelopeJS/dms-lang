import { freshId, lang, pick, seedWorkspace } from "../../lang.mjs";
import { focusedName } from "../../files.mjs";

/** @typedef {import("../../lang.mjs").Ctx} Ctx */

/**
 * @param {Ctx} ctx The journey
 * @returns {Promise<string>} A workspace of three keys with only their English text, in English and French
 */
async function bare(ctx) {
  const id = freshId(ctx, "more");
  await seedWorkspace(ctx, id, { locales: ["en", "fr"], keys: { "a.one": { en: "One" }, "a.two": { en: "Two" }, "a.three": { en: "Three" } } });
  return id;
}

const open = (/** @type {string} */ key) => ({ role: "button", name: `Open ${key} in the panel` });

/** Rows that stay while one works, the empty matrix, filters a workspace cannot have, arrow keys and the cell's refusals. */
export const moreMatrixJourneys = [
  {
    id: "finished-rows-stay-and-are-counted",
    title: "a row just translated stays in the Missing view, the footer counts what is left, and a banner counts the keys done and hides them",
    entryPoint: "/modules/lang/translations?filter=missing",
    async run(/** @type {Ctx} */ ctx) {
      const id = await bare(ctx);
      const tab = await ctx.tab("admin");
      await tab.signIn("admin");
      await tab.goto(`/modules/lang/translations?workspace=${id}&filter=missing`);
      await ctx.verify("the footer counts the incomplete keys and the missing translations", [tab.shows(/3 incomplete keys · 3 missing translations in (Français|1 language)/)]);
      await tab.click({ role: "button", name: "Translate a.one into Français" });
      await tab.fill({ role: "textbox", name: "Translate a.one into Français" }, "Un");
      await tab.press("Control+Enter", { role: "textbox", name: "Translate a.one into Français" });
      await ctx.verify("the translated row stays, the footer counts two, a banner counts one key done", [
        tab.visible(open("a.one")),
        tab.shows(/2 incomplete keys · 2 missing translations in (Français|1 language)/),
        tab.shows(/1 key done in this view/),
      ]);
      await tab.click({ role: "button", name: "Hide done keys" });
      await ctx.verify("Hide done keys takes it off the view", [tab.visible(open("a.one"), { hidden: true }), tab.visible(open("a.two"))]);
    },
  },
  {
    id: "an-empty-matrix-says-why",
    title: "a workspace without keys offers to add one; a search that matches nothing offers to show every key",
    entryPoint: "/modules/lang/translations",
    async run(/** @type {Ctx} */ ctx) {
      const empty = freshId(ctx, "nokeys");
      await seedWorkspace(ctx, empty, { locales: ["en", "fr"] });
      const full = await bare(ctx);
      const tab = await ctx.tab("admin");
      await tab.signIn("admin");
      await tab.goto(`/modules/lang/translations?workspace=${empty}`);
      await ctx.verify("no key yet: Add key is offered", [tab.shows(/no key|No keys|first key/i), tab.visible({ role: "button", name: /Add (first )?key/ })]);
      await tab.goto(`/modules/lang/translations?workspace=${full}&q=zzzz-nothing`);
      await ctx.verify("no match: the keys are hidden and a way to show them all is offered", [tab.visible(open("a.one"), { hidden: true }), tab.visible({ role: "button", name: /Show all|Clear|Reset/i })]);
    },
  },
  {
    id: "filters-a-workspace-cannot-have-are-dropped",
    title: "a link naming a language or a namespace the workspace lacks shows every key",
    entryPoint: "/modules/lang/translations?namespace=&missingIn=",
    async run(/** @type {Ctx} */ ctx) {
      const id = await bare(ctx);
      const tab = await ctx.tab("admin");
      await tab.signIn("admin");
      await tab.goto(`/modules/lang/translations?workspace=${id}&namespace=nope&missingIn=zz&filter=missing`);
      await ctx.verify("every key is listed, under every language and every namespace", [
        tab.visible(open("a.one")),
        tab.visible(open("a.three")),
        tab.visible({ role: "button", name: "Languages 2/2" }),
      ]);
    },
  },
  {
    id: "arrow-keys-move-between-cells",
    title: "the arrow keys move the focus between the cells of the grid",
    entryPoint: "/modules/lang/translations > a cell",
    async run(/** @type {Ctx} */ ctx) {
      const id = await bare(ctx);
      const tab = await ctx.tab("admin");
      await tab.signIn("admin");
      await tab.goto(`/modules/lang/translations?workspace=${id}`);
      const first = { role: "button", name: "Translate a.one into Français" };
      await tab.visible(first);
      await tab.page.getByRole("button", { name: "Translate a.one into Français" }).focus();
      await tab.press("ArrowDown");
      await ctx.verify("ArrowDown moves to the cell below", [ctx.equal("focus", await focusedName(tab), "Translate a.two into Français")]);
      await tab.press("ArrowUp");
      await ctx.verify("ArrowUp moves back", [ctx.equal("focus", await focusedName(tab), "Translate a.one into Français")]);
    },
  },
  {
    id: "a-cell-keeps-what-cannot-be-saved",
    title: "a text vue-i18n cannot compile stays Not saved in its cell and writes nothing; clearing the base text asks first",
    entryPoint: "/modules/lang/translations > a cell",
    async run(/** @type {Ctx} */ ctx) {
      const id = await bare(ctx);
      const tab = await ctx.tab("admin");
      await tab.signIn("admin");
      await tab.goto(`/modules/lang/translations?workspace=${id}`);
      await tab.click({ role: "button", name: "Translate a.one into Français" });
      await tab.fill({ role: "textbox", name: "Translate a.one into Français" }, "jane@example.com");
      await tab.press("Control+Enter", { role: "textbox", name: "Translate a.one into Français" });
      const stored = await lang(ctx, "read the key", "GET", `/row?workspace=${id}&key=a.one`);
      await ctx.verify("the cell says Not saved and the key is untouched", [tab.shows(/Not saved/), ctx.equal("values", pick(stored.body, "row", "values"), { en: "One" })]);
      await tab.goto(`/modules/lang/translations?workspace=${id}`);
      await tab.click({ role: "button", name: "One", exact: true });
      await tab.fill({ role: "textbox", name: /^Edit a\.one in English/ }, "");
      await tab.press("Control+Enter", { role: "textbox", name: /^Edit a\.one in English/ });
      await ctx.verify("clearing the base text asks first", [tab.visible({ role: "dialog", name: "Clear the base text of a.one?" })]);
      const kept = await lang(ctx, "read the key again", "GET", `/row?workspace=${id}&key=a.one`);
      await ctx.verify("nothing was cleared before the answer", [ctx.equal("values", pick(kept.body, "row", "values"), { en: "One" })]);
    },
  },
];
