import { freshId, lang, pick, seedWorkspace } from "../../lang.mjs";

/** @typedef {import("../../lang.mjs").Ctx} Ctx */

/**
 * @param {Ctx} ctx The journey
 * @returns {Promise<string>} A workspace of three keys in the order shop.title, shop.pay, auth.login, French lacking shop.pay
 */
async function panelWorkspace(ctx) {
  const id = freshId(ctx, "panel");
  await seedWorkspace(ctx, id, {
    locales: ["en", "fr"],
    keys: { "shop.title": { en: "Shop", fr: "Boutique" }, "shop.pay": { en: "Pay {price}" }, "auth.login": { en: "Hello", fr: "Salut" } },
  });
  return id;
}

/** The key panel: moving between keys, inserting a placeholder, and the saves that keep it open. */
export const panelJourneys = [
  {
    id: "key-panel-moves-between-keys",
    title: "the panel's header places the key among the listed keys with its namespace, the arrows and J / K move to the next and previous key, and J typed in a field stays in the field",
    entryPoint: "/modules/lang/translations?key= > Previous, Next, J, K",
    async run(/** @type {Ctx} */ ctx) {
      const id = await panelWorkspace(ctx);
      const tab = await ctx.tab("admin");
      await tab.signIn("admin");
      await tab.goto(`/modules/lang/translations?workspace=${id}&key=shop.pay`);
      await ctx.verify("the header shows the key, its place and its namespace", [tab.visible({ role: "heading", name: "shop.pay" }), tab.shows(/2 of 3\W*shop/)]);
      await tab.click({ role: "heading", name: "shop.pay" });
      await tab.press("j");
      await ctx.verify("J opens the next key", [tab.visible({ role: "heading", name: "auth.login" }), tab.shows(/3 of 3\W*auth/)]);
      await tab.press("k");
      await ctx.verify("K opens the previous key", [tab.visible({ role: "heading", name: "shop.pay" }), tab.shows(/2 of 3/)]);
      await tab.click({ role: "button", name: "Previous", exact: true });
      await ctx.verify("the up arrow opens the previous key", [tab.visible({ role: "heading", name: "shop.title" }), tab.shows(/1 of 3/)]);
      await tab.click({ role: "button", name: "Next", exact: true });
      await ctx.verify("the down arrow opens the next key", [tab.visible({ role: "heading", name: "shop.pay" })]);
      await tab.fill({ role: "textbox", name: "Français" }, "Payer ");
      await tab.press("j", { role: "textbox", name: "Français" });
      await ctx.verify("J typed in a field is text, not a move", [tab.visible({ role: "heading", name: "shop.pay" }), ctx.equal("the field", await tab.value({ role: "textbox", name: "Français" }), "Payer j")]);
    },
  },
  {
    id: "key-panel-inserts-a-token-and-saves-on-leave",
    title: "Insert {token} adds the placeholder the text lacks, and a field is saved as soon as it is left, without Save",
    entryPoint: "/modules/lang/translations?key= > Insert {price}",
    async run(/** @type {Ctx} */ ctx) {
      const id = await panelWorkspace(ctx);
      const tab = await ctx.tab("admin");
      await tab.signIn("admin");
      await tab.goto(`/modules/lang/translations?workspace=${id}&key=shop.pay`);
      await tab.fill({ role: "textbox", name: "Français" }, "Payer ");
      await ctx.verify("the panel flags the missing placeholder and offers to insert it", [tab.visible({ role: "button", name: "Insert {price}" })]);
      await tab.click({ role: "button", name: "Insert {price}" });
      await ctx.verify("the placeholder is in the field", [ctx.equal("the field", await tab.value({ role: "textbox", name: "Français" }), "Payer {price}")]);
      await tab.press("Tab", { role: "textbox", name: "Français" });
      const saved = await lang(ctx, "read the key", "GET", `/row?workspace=${id}&key=shop.pay`);
      await ctx.verify("leaving the field saved it", [ctx.holds("French text", String(pick(saved.body, "row", "values", "fr")).includes("{price}"), JSON.stringify(pick(saved.body, "row", "values")))]);
    },
  },
  {
    id: "key-panel-stays-open-on-a-failed-save",
    title: "closing the panel with a text that cannot be saved keeps it open on that text, and clearing the base text asks first",
    entryPoint: "/modules/lang/translations?key= > Close",
    async run(/** @type {Ctx} */ ctx) {
      const id = await panelWorkspace(ctx);
      const tab = await ctx.tab("admin");
      await tab.signIn("admin");
      await tab.goto(`/modules/lang/translations?workspace=${id}&key=shop.pay`);
      await tab.fill({ role: "textbox", name: "Français" }, "Payer {price");
      await tab.click({ role: "button", name: "Close" });
      const kept = await lang(ctx, "read the key", "GET", `/row?workspace=${id}&key=shop.pay`);
      await ctx.verify("the panel stays open on the unsaved text and nothing is written", [
        tab.visible({ role: "dialog", name: "shop.pay" }),
        ctx.equal("the field", await tab.value({ role: "textbox", name: "Français" }), "Payer {price"),
        ctx.equal("values", pick(kept.body, "row", "values"), { en: "Pay {price}" }),
      ]);
      await tab.fill({ role: "textbox", name: "Français" }, "Payer {price}");
      await tab.click({ role: "button", name: "Close" });
      const fixed = await lang(ctx, "read the key again", "GET", `/row?workspace=${id}&key=shop.pay`);
      await ctx.verify("once the text is valid, closing saves it and closes", [
        tab.visible({ role: "dialog", name: "shop.pay" }, { hidden: true }),
        ctx.equal("values", pick(fixed.body, "row", "values"), { en: "Pay {price}", fr: "Payer {price}" }),
      ]);
      await tab.goto(`/modules/lang/translations?workspace=${id}&key=shop.title`);
      await tab.fill({ role: "textbox", name: "English" }, "");
      await tab.click({ role: "button", name: "Save", exact: true });
      const base = await lang(ctx, "read the base text", "GET", `/row?workspace=${id}&key=shop.title`);
      await ctx.verify("clearing the base text asks for a confirmation and clears nothing before it", [
        tab.shows(/Clear the base text of shop\.title\?/),
        ctx.equal("values", pick(base.body, "row", "values"), { en: "Shop", fr: "Boutique" }),
      ]);
    },
  },
];
