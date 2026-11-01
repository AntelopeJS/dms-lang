import { freshId, guarded, lang, seedWorkspace } from "../lang.mjs";

/** @typedef {import("../lang.mjs").Ctx} Ctx */

/** Every write publishes on the dms-lang.translations topic, so another tab sees it without reloading. */
export const journeys = guarded([
  {
    id: "another-tab-sees-an-edit",
    title: "a text saved in one tab, or by an API caller, shows in an open matrix tab without a reload",
    entryPoint: "the dms-lang.translations realtime topic",
    async run(/** @type {Ctx} */ ctx) {
      const id = freshId(ctx, "live");
      await seedWorkspace(ctx, id, { locales: ["en", "fr"], keys: { "a.one": { en: "One" }, "a.two": { en: "Two" } } });
      const writer = await ctx.tab("admin", "writer");
      await writer.signIn("admin");
      const reader = await ctx.tab("admin", "reader");
      await reader.goto(`/modules/lang/translations?workspace=${id}`);
      await ctx.verify("the reader sees both keys missing in French", [reader.visible({ role: "button", name: "Translate a.one into Français" }), reader.visible({ role: "button", name: "Translate a.two into Français" })], { critical: true });
      await writer.goto(`/modules/lang/translations?workspace=${id}`);
      await writer.click({ role: "button", name: "Translate a.one into Français" });
      await writer.fill({ role: "textbox", name: "Translate a.one into Français" }, "Un");
      await writer.press("Enter", { role: "textbox", name: "Translate a.one into Français" });
      await ctx.verify("the text saved in the writer's tab appears in the reader's tab", [reader.visible({ role: "button", name: "Un" })]);
      await lang(ctx, "translate a.two through the API", "PUT", "/key", { workspace: id, path: "a.two", values: { fr: "Deux" } });
      await ctx.verify("a write through the API appears too", [reader.visible({ role: "button", name: "Deux" })]);
    },
  },
]);
