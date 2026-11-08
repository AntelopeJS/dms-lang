import { currentUrl, directionOf, namesInOrder } from "../../files.mjs";
import { eventually, freshId, lang, list, pick, seedWorkspace } from "../../lang.mjs";

/** @typedef {import("../../lang.mjs").Ctx} Ctx */

/** The Workspaces page's sort and search, the direction of a right-to-left language, and what a header action hides. */
export const moreWorkspaceJourneys = [
  {
    id: "workspaces-sort-and-search-by-description-and-type",
    title: "the sort menu orders the cards by name or least translated first, and the search matches the id, the description and the type",
    entryPoint: "/modules/lang/workspaces",
    async run(/** @type {Ctx} */ ctx) {
      const before = await lang(ctx, "list the workspaces", "GET", "/workspaces");
      for (const workspace of list(before.body, "workspaces")) {
        if (workspace.kind === "added") await lang(ctx, `delete ${String(workspace.id)}`, "DELETE", "/workspace", { id: workspace.id });
      }
      const alpha = freshId(ctx, "zz-alpha").replace(/^zz-alpha/, "sa");
      const beta = freshId(ctx, "zz-beta").replace(/^zz-beta/, "sb");
      await seedWorkspace(ctx, alpha, { locales: ["en", "fr"], keys: { "a.one": { en: "One", fr: "Un" } } });
      await seedWorkspace(ctx, beta, { locales: ["en", "fr"], keys: { "a.one": { en: "One" } } });
      await lang(ctx, "describe the second", "PATCH", "/workspace", { id: beta, description: "Texts of the ferryboat app", type: "mobile" });
      const tab = await ctx.tab("admin");
      await tab.signIn("admin");
      await tab.goto("/modules/lang/workspaces");
      await tab.click({ role: "combobox", name: "Sort workspaces" });
      await tab.click({ role: "option", name: "Name" });
      await ctx.verify("by name the created workspaces follow their ids", [ctx.equal("order", await namesInOrder(tab, "heading", [alpha, beta]), `${alpha}|${beta}`)]);
      await tab.click({ role: "combobox", name: "Sort workspaces" });
      await tab.click({ role: "option", name: "Least translated first" });
      await ctx.verify("least translated first puts the incomplete one before the complete one", [ctx.equal("order", await namesInOrder(tab, "heading", [alpha, beta]), `${beta}|${alpha}`)]);
      await tab.fill({ role: "textbox", name: "Search by name or description" }, "ferryboat");
      await ctx.verify("the search matches a description", [tab.visible({ role: "heading", name: beta }), tab.visible({ role: "heading", name: alpha }, { hidden: true })]);
      await tab.fill({ role: "textbox", name: "Search by name or description" }, "mobile");
      await ctx.verify("the search matches the type", [tab.visible({ role: "heading", name: beta }), tab.visible({ role: "heading", name: alpha }, { hidden: true })]);
    },
  },
  {
    id: "right-to-left-languages-are-written-right-to-left",
    title: "the queue sets dir=rtl on the text of an Arabic translation and dir=ltr on an English one",
    entryPoint: "/modules/lang/language?locale=ar",
    async run(/** @type {Ctx} */ ctx) {
      const id = freshId(ctx, "rtl");
      await seedWorkspace(ctx, id, { locales: ["en", "ar", "fr"], keys: { "a.one": { en: "One" } } });
      const tab = await ctx.tab("admin");
      await tab.signIn("admin");
      await tab.goto(`/modules/lang/language?workspace=${id}&locale=ar`);
      await tab.visible({ role: "textbox", name: "One" });
      await ctx.verify("the Arabic field is right to left", [ctx.equal("dir", await directionOf(tab, { role: "textbox", name: "One" }), "rtl")]);
      await tab.goto(`/modules/lang/language?workspace=${id}&locale=fr`);
      await tab.visible({ role: "textbox", name: "One" });
      await ctx.verify("the French field is left to right", [ctx.equal("dir", await directionOf(tab, { role: "textbox", name: "One" }), "ltr")]);
    },
  },
  {
    id: "card-buttons-stay-inside-a-card-with-a-long-url",
    title: "a card whose public URL or folder path is long keeps its buttons inside the card, and a pointer click on Switch switches",
    entryPoint: "/modules/lang/workspaces",
    async run(/** @type {Ctx} */ ctx) {
      const long = `${freshId(ctx, "long").replace(/[^a-z0-9]/g, "")}`.padEnd(64, "x").slice(0, 64);
      const current = freshId(ctx, "current");
      await seedWorkspace(ctx, long, { locales: ["en"] });
      await seedWorkspace(ctx, current, { locales: ["en"] });
      const tab = await ctx.tab("admin");
      await tab.signIn("admin");
      await tab.goto(`/modules/lang/workspaces?workspace=${current}`);
      await tab.visible({ role: "heading", name: long });
      const outside = String(
        await tab.page.evaluate(() =>
          [...document.querySelectorAll(".dms-card")]
            .flatMap((card) => {
              const edge = card.getBoundingClientRect().right;
              return [...card.querySelectorAll("button, a")].filter((button) => button.getBoundingClientRect().right > edge + 0.5).map((button) => button.textContent?.trim() || button.getAttribute("aria-label") || "?");
            })
            .join("|"),
        ),
      );
      await ctx.verify("every card's buttons end inside the card", [ctx.equal("buttons past a card's edge", outside, "")]);
      const clicked = String(
        await tab.page
          .locator(".dms-card")
          .filter({ hasText: long })
          .getByRole("button", { name: "Switch", exact: true })
          .click({ timeout: 5000 })
          .then(
            () => "",
            (/** @type {Error} */ error) => error.message.split("\n")[0] ?? "",
          ),
      );
      const switched = Boolean(
        await tab.page.waitForURL((/** @type {URL} */ url) => url.searchParams.get("workspace") === long, { timeout: 5000 }).then(
          () => true,
          () => false,
        ),
      );
      await ctx.verify("a pointer click on Switch opens the workspace", [ctx.equal("click error", clicked, ""), ctx.holds("the workspace is in the URL", switched, currentUrl(tab))]);
    },
  },
  {
    id: "installed-modules-take-no-new-key",
    title: "the matrix of the installed modules offers no Add key, and the matrix of the project files does",
    entryPoint: "/modules/lang/translations",
    async run(/** @type {Ctx} */ ctx) {
      const tab = await ctx.tab("admin");
      await tab.signIn("admin");
      await tab.goto("/modules/lang/translations?workspace=modules");
      await ctx.verify("the installed modules ship their keys: no Add key", [tab.shows(/Read-only/), tab.visible({ role: "link", name: "Add key" }, { hidden: true }), tab.visible({ role: "button", name: "Add key" }, { hidden: true })]);
      await tab.goto("/modules/lang/translations?workspace=default");
      await ctx.verify("the project files take keys", [tab.visible({ role: "link", name: "Add key" })]);
    },
  },
  {
    id: "type-click-right-after-typing-a-description",
    title: "a click on a Type radio while the description field still has focus saves both the description and the type",
    entryPoint: "/modules/lang/workspace",
    async run(/** @type {Ctx} */ ctx) {
      const id = freshId(ctx, "typeclick");
      await seedWorkspace(ctx, id, { locales: ["en"] });
      const tab = await ctx.tab("admin");
      await tab.signIn("admin");
      await tab.goto(`/modules/lang/workspace?workspace=${id}`);
      await tab.fill({ role: "textbox", name: "Texts of the iOS and Android app" }, "Texts of the shop");
      await tab.click({ role: "radio", name: "Website" });
      await eventually(() => lang(ctx, "wait for the description", "GET", `/workspace?workspace=${id}`), (answer) => pick(answer.body, "description") === "Texts of the shop");
      const saved = await eventually(() => lang(ctx, "wait for the type", "GET", `/workspace?workspace=${id}`), (answer) => pick(answer.body, "type") === "website");
      await ctx.verify("the one click saved the type as well as the description", [ctx.equal("description", pick(saved.body, "description"), "Texts of the shop"), ctx.equal("type", pick(saved.body, "type"), "website")]);
    },
  },
];
