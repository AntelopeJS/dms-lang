import { freshId, guarded, lang, pick, raw, recordRaw } from "../lang.mjs";

/** @typedef {import("../lang.mjs").Ctx} Ctx */

/** The fixed smoke journey: the introduction's "publish one translated message", through the dashboard. */
export const journeys = guarded([
  {
    id: "smoke",
    title: "an owner creates a workspace, adds French and a key, translates it in the matrix, and the public URL serves the message",
    entryPoint: "Workspaces > New workspace, Add language, Add key, a matrix cell",
    async run(/** @type {Ctx} */ ctx) {
      const id = freshId(ctx, "storefront");
      const tab = await ctx.tab("admin");
      await tab.signIn("admin");
      await tab.goto("/modules/lang/workspaces");
      await tab.click({ role: "button", name: "New workspace" });
      await tab.fill({ role: "textbox", name: "Workspace name" }, id);
      await tab.click({ role: "button", name: "Create workspace" });
      await ctx.verify("the new workspace opens on its settings", [tab.at(/^\/modules\/lang\/workspace$/), tab.shows(new RegExp(id))], { critical: true });
      await tab.goto(`/modules/lang/overview?workspace=${id}`);
      await tab.click({ role: "button", name: "Add language" });
      await tab.click({ role: "option", name: "Français French fr", exact: true });
      await tab.click({ role: "button", name: "Add Français · fr" });
      await ctx.verify("French is listed beside the base language", [tab.visible({ role: "cell", name: /Français/ }), tab.visible({ role: "cell", name: /English/ })]);
      await tab.goto(`/modules/lang/translations?workspace=${id}&action=add-key`);
      await tab.fill({ role: "textbox", name: "Key path" }, "checkout.pay");
      await tab.fill({ role: "textbox", name: "English en base" }, "Pay now");
      await tab.click({ role: "button", name: "Add key" });
      await ctx.verify("the key is listed with its English text", [tab.visible({ role: "button", name: "checkout.pay", exact: true }), tab.visible({ role: "button", name: "Pay now" })]);
      await tab.click({ role: "button", name: "Translate checkout.pay into Français" });
      await tab.fill({ role: "textbox", name: "Translate checkout.pay into Français" }, "Payer maintenant");
      await tab.press("Enter", { role: "textbox", name: "Translate checkout.pay into Français" });
      await ctx.verify("the French cell shows the saved text", [tab.visible({ role: "button", name: "Payer maintenant" })]);
      const served = await raw(ctx, "read the French file", { path: `/i18n/${id}/fr.json` });
      recordRaw(ctx, served, [ctx.equal("status", served.status, 200), ctx.equal("the public file holds the message", served.json, { checkout: { pay: "Payer maintenant" } })]);
      const row = await lang(ctx, "read the key through the API", "GET", `/row?workspace=${id}&key=checkout.pay`);
      await tab.reload();
      await ctx.verify("a reload and the API show the same texts", [
        tab.visible({ role: "button", name: "Payer maintenant" }),
        ctx.equal("row", pick(row.body, "row", "values"), { en: "Pay now", fr: "Payer maintenant" }),
      ]);
    },
  },
]);
