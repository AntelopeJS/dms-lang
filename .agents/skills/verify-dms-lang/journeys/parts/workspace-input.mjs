import { chooseFile } from "../../files.mjs";
import { clickUntil, eventually, freshId, lang, list, pick, readLocaleFile, seedWorkspace } from "../../lang.mjs";

/** @typedef {import("../../lang.mjs").Ctx} Ctx */

const SEARCH = { role: "combobox", name: /^Search languages or type a code/ };

/** What a person types into the language picker, the i18next setup and the Import chooser. */
export const inputJourneys = [
  {
    id: "language-search-rules",
    title: "the language search ignores accents, reads fr_FR as fr-FR and takes a long word as a name, never as a code",
    entryPoint: "/modules/lang/workspace > Add language",
    async run(/** @type {Ctx} */ ctx) {
      const id = freshId(ctx, "search");
      await seedWorkspace(ctx, id, { locales: ["en"] });
      const tab = await ctx.tab("admin");
      await tab.signIn("admin");
      await tab.goto(`/modules/lang/workspace?workspace=${id}`);
      await clickUntil(tab, { role: "button", name: "Add language", exact: true }, { role: "dialog" });
      await tab.fill(SEARCH, "francais");
      await ctx.verify("francais finds Français", [tab.visible({ role: "option", name: /^Français French fr$/ })]);
      await tab.fill(SEARCH, "espanol");
      await ctx.verify("espanol finds Español", [tab.visible({ role: "option", name: /^Español Spanish es$/ })]);
      await tab.fill(SEARCH, "french");
      await ctx.verify("french finds French by its name and is not offered as a code", [
        tab.visible({ role: "option", name: /^Français French fr$/ }),
        tab.visible({ role: "option", name: /^french/i }, { hidden: true }),
      ]);
      await tab.fill(SEARCH, "fr_FR");
      await ctx.verify("fr_FR finds the code fr-FR", [tab.visible({ role: "option", name: /^Français \(France\) French \(France\) fr-FR$/ })]);
      await tab.click({ role: "option", name: /^Français \(France\) French \(France\) fr-FR$/ });
      await tab.click({ role: "button", name: /^Add .*fr-FR$/, within: { role: "dialog" } });
      const added = await eventually(() => lang(ctx, "read the languages", "GET", `/workspace?workspace=${id}`), (answer) => list(answer.body, "locales").length === 2);
      await ctx.verify("the language is added as fr-FR", [ctx.equal("locales", pick(added.body, "locales"), [{ code: "en" }, { code: "fr-FR" }])]);
    },
  },
  {
    id: "i18next-lists-the-bare-language",
    title: "the i18next setup lists the language of each region (pt for pt-BR), which i18next needs to accept the region",
    entryPoint: "GET /api/lang/translations/snippet?kind=i18next",
    async run(/** @type {Ctx} */ ctx) {
      const id = freshId(ctx, "regions");
      await seedWorkspace(ctx, id, { locales: ["en", "pt-BR"] });
      const answer = await lang(ctx, "read the i18next setup", "GET", `/snippet?workspace=${id}&kind=i18next`);
      const code = String(pick(answer.body, "code"));
      const line = /supportedLngs: (\[[^\]]*\])/.exec(code)?.[1] ?? "[]";
      /** @type {unknown} */
      let supported = null;
      try {
        supported = JSON.parse(line);
      } catch {
        supported = null;
      }
      await ctx.verify("supportedLngs holds the codes and their languages", [ctx.equal("supportedLngs", supported, ["en", "pt", "pt-BR"])]);
    },
  },
  {
    id: "import-reads-a-single-language-file",
    title: "Import takes a file named after a language code (it.json) as that language and creates a workspace from it",
    entryPoint: "/modules/lang/workspaces > Import…",
    async run(/** @type {Ctx} */ ctx) {
      const id = freshId(ctx, "single");
      const tab = await ctx.tab("admin");
      await tab.signIn("admin");
      await tab.goto("/modules/lang/workspaces");
      const chosen = await chooseFile(tab, { role: "button", name: "Import…" }, { name: "it.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify({ shop: { title: "Negozio" } })) });
      await ctx.verify("the dialog reads the file as Italian", [
        ctx.holds("file chooser", chosen, "no file chooser opened"),
        tab.visible({ role: "dialog", name: "Import a workspace" }),
        tab.shows(/Italiano\s*·\s*it/),
      ]);
      await tab.fill({ role: "textbox", name: "Workspace name" }, id);
      await tab.click({ role: "button", name: "Import workspace" });
      const created = await eventually(() => lang(ctx, "read the imported workspace", "GET", `/workspace?workspace=${id}`), (answer) => answer.status === 200);
      await ctx.verify("the workspace has the file's language as its base and its texts", [
        ctx.status(created, 200),
        ctx.equal("locales", pick(created.body, "locales"), [{ code: "it" }]),
        ctx.equal("base", pick(created.body, "defaultLocale"), "it"),
        ctx.equal("file", readLocaleFile(ctx, id, "it"), { shop: { title: "Negozio" } }),
      ]);
    },
  },
  {
    id: "fetch-snippet-loads-the-base-first",
    title: "the fetch setup loads the base, then the language, then the region, so the region wins over the base",
    entryPoint: "GET /api/lang/translations/snippet?kind=fetch",
    async run(/** @type {Ctx} */ ctx) {
      const id = freshId(ctx, "fetched");
      await seedWorkspace(ctx, id, { locales: ["en", "fr"] });
      const answer = await lang(ctx, "read the fetch setup", "GET", `/snippet?workspace=${id}&kind=fetch`);
      const code = String(pick(answer.body, "code"));
      await ctx.verify("the files are merged base, language, region in that order", [
        ctx.holds("order", code.includes('const codes = [...new Set([base, locale.split("-")[0], locale])];'), code.slice(0, 600)),
        ctx.holds("later files override earlier ones", code.includes("files.reduce(merge, {})"), code.slice(-300)),
      ]);
    },
  },
  {
    id: "toolbar-appears-from-four-workspaces",
    title: "the Workspaces page shows a search field and a sort menu from four workspaces on, and the search narrows the cards",
    entryPoint: "/modules/lang/workspaces",
    async run(/** @type {Ctx} */ ctx) {
      const before = await lang(ctx, "list the workspaces", "GET", "/workspaces");
      for (const workspace of list(before.body, "workspaces")) {
        if (workspace.kind === "added") await lang(ctx, `delete ${String(workspace.id)}`, "DELETE", "/workspace", { id: workspace.id });
      }
      const kept = list((await lang(ctx, "list what is left", "GET", "/workspaces")).body, "workspaces").length;
      const first = freshId(ctx, "cards");
      const second = freshId(ctx, "cards");
      for (let n = kept; n < 2; n += 1) await lang(ctx, "fill up to two", "POST", "/workspace", { id: freshId(ctx, "pad"), locale: { code: "en" } });
      await lang(ctx, "create the third workspace", "POST", "/workspace", { id: first, locale: { code: "en" } });
      const tab = await ctx.tab("admin");
      await tab.signIn("admin");
      await tab.goto("/modules/lang/workspaces");
      await ctx.verify("three workspaces: the cards, no search and no sort", [
        tab.visible({ role: "heading", name: first }),
        tab.visible({ role: "textbox", name: "Search by name or description" }, { hidden: true }),
        tab.visible({ role: "combobox", name: "Sort workspaces" }, { hidden: true }),
      ]);
      await lang(ctx, "create the fourth workspace", "POST", "/workspace", { id: second, locale: { code: "en" } });
      await tab.goto("/modules/lang/workspaces");
      await ctx.verify("four workspaces: a search field and a sort menu", [
        tab.visible({ role: "textbox", name: "Search by name or description" }),
        tab.visible({ role: "combobox", name: "Sort workspaces" }),
      ]);
      await tab.fill({ role: "textbox", name: "Search by name or description" }, second);
      await ctx.verify("the search narrows the cards to the match", [
        tab.visible({ role: "heading", name: second }),
        tab.visible({ role: "heading", name: first }, { hidden: true }),
      ]);
    },
  },
];
