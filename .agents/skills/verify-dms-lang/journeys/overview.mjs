import { freshId, guarded, lang, list, pick, seedWorkspace, workspaceFiles } from "../lang.mjs";

/** @typedef {import("../lang.mjs").Ctx} Ctx */

/**
 * @param {Ctx} ctx The journey
 * @returns {Promise<string>} A workspace with English as base, French and German each missing two of four keys
 */
async function overviewWorkspace(ctx) {
  const id = freshId(ctx, "overview");
  await seedWorkspace(ctx, id, {
    locales: ["en", "fr", "de"],
    keys: {
      "shop.title": { en: "Shop", fr: "Boutique", de: "Laden" },
      "shop.pay": { en: "Pay {price}", de: "Zahle {price}" },
      "auth.login": { en: "Hello {name}", fr: "Salut {name}" },
      "auth.logout": { en: "Bye" },
    },
  });
  return id;
}

/** The Overview: how translated is this workspace, and where are the gaps. */
export const journeys = guarded([
  {
    id: "kpis-and-coverage-by-namespace",
    title: "the Overview counts languages, keys, missing translations and the average coverage, and the heatmap links each gap to the matrix",
    entryPoint: "/modules/lang/overview",
    async run(/** @type {Ctx} */ ctx) {
      const id = await overviewWorkspace(ctx);
      const tab = await ctx.tab("admin");
      await tab.signIn("admin");
      await tab.goto(`/modules/lang/overview?workspace=${id}`);
      await ctx.verify("the scope bar and the four figures", [
        tab.shows(/editable/i),
        tab.shows(/3 languages/i),
        tab.shows(/4 keys/i),
        tab.shows(/base\s*en/i),
        tab.shows(/served at .*\/i18n\/.*\/\{locale\}\.json/i),
        tab.shows(/languages\s*3\s*1 base · 2 translated from it/i),
        tab.shows(/translation keys\s*4\s*in 2 namespaces/i),
        tab.shows(/missing translations\s*4\s*empty cells across 2 languages/i),
        tab.shows(/average coverage\s*50%\s*excluding the base language/i),
      ]);
      await ctx.verify("the language rows tell the missing count and the heatmap labels each cell", [
        tab.visible({ role: "cell", name: "English base en · 4 strings" }),
        tab.visible({ role: "cell", name: "Deutsch de · 50% · 2 missing" }),
        tab.visible({ role: "cell", name: "Français fr · 50% · 2 missing" }),
        tab.visible({ role: "link", name: "auth · Deutsch: 2 keys missing out of 2" }),
        tab.visible({ role: "link", name: "auth · Français: 1 key missing out of 2" }),
        tab.visible({ role: "link", name: "shop · Deutsch: all translated (2)" }),
        tab.visible({ role: "link", name: "shop · Français: 1 key missing out of 2" }),
      ]);
      await tab.click({ role: "link", name: "auth · Français: 1 key missing out of 2" });
      await ctx.verify("a heatmap cell opens the matrix on that namespace's missing keys", [
        tab.at(/^\/modules\/lang\/translations$/),
        tab.visible({ role: "button", name: "Open auth.logout in the panel" }),
        tab.visible({ role: "button", name: "Open shop.title in the panel" }, { hidden: true }),
      ]);
    },
  },
  {
    id: "header-action-targets-the-least-complete-language",
    title: "the primary action names the language with the most gaps and jumps to its missing keys",
    entryPoint: "/modules/lang/overview header",
    async run(/** @type {Ctx} */ ctx) {
      const id = freshId(ctx, "overview");
      await seedWorkspace(ctx, id, {
        locales: ["en", "fr", "de"],
        keys: { "a.one": { en: "One", fr: "Un" }, "a.two": { en: "Two", fr: "Deux" }, "a.three": { en: "Three" } },
      });
      const tab = await ctx.tab("admin");
      await tab.signIn("admin");
      await tab.goto(`/modules/lang/overview?workspace=${id}`);
      await ctx.verify("the action counts the gaps of Deutsch, the least complete", [tab.visible({ role: "link", name: "Translate 3 missing in Deutsch" })]);
      await tab.click({ role: "link", name: "Translate 3 missing in Deutsch" });
      await ctx.verify("it opens the matrix on the keys German lacks", [tab.at(/^\/modules\/lang\/translations$/), tab.visible({ role: "button", name: "Open a.one in the panel" })]);
    },
  },
  {
    id: "remove-a-language-asks-for-its-code",
    title: "the row menu makes a language the base after listing what lacks, and removes one only after its code is typed",
    entryPoint: "/modules/lang/overview > Actions for <language>",
    async run(/** @type {Ctx} */ ctx) {
      const id = await overviewWorkspace(ctx);
      const tab = await ctx.tab("admin");
      await tab.signIn("admin");
      await tab.goto(`/modules/lang/overview?workspace=${id}`);
      await tab.click({ role: "button", name: "Actions for Français" });
      await tab.click({ role: "menuitem", name: "Make Français the base language" });
      await ctx.verify("the dialog lists the keys French lacks", [
        tab.visible({ role: "dialog", name: "Make Français the base language?" }),
        tab.shows(/2 keys have no text in Français/),
        tab.shows(/shop\.pay/),
        tab.shows(/auth\.logout/),
      ]);
      await tab.click({ role: "button", name: "Cancel" });
      const unchanged = await lang(ctx, "read the base", "GET", `/workspace?workspace=${id}`);
      await ctx.verify("cancelling changes nothing", [ctx.equal("base", pick(unchanged.body, "defaultLocale"), "en")]);
      await tab.click({ role: "button", name: "Actions for Deutsch" });
      await tab.click({ role: "menuitem", name: "Remove Deutsch" });
      await ctx.verify("the removal dialog names the file and needs the code", [
        tab.visible({ role: "dialog", name: /Remove Deutsch from/ }),
        tab.shows(/de\.json is deleted/),
      ]);
      await tab.click({ role: "button", name: "Remove language" });
      const untouched = await lang(ctx, "read the languages", "GET", `/workspace?workspace=${id}`);
      await ctx.verify("without the code nothing is removed", [ctx.equal("languages", list(untouched.body, "locales").map((locale) => locale.code), ["de", "en", "fr"])]);
      await tab.fill({ role: "textbox", name: "Type de to confirm" }, "de");
      await tab.click({ role: "button", name: "Remove language" });
      const after = await lang(ctx, "read the languages", "GET", `/workspace?workspace=${id}`);
      await ctx.verify("German is removed with its file", [
        ctx.equal("languages", list(after.body, "locales").map((locale) => locale.code), ["en", "fr"]),
        ctx.equal("files", workspaceFiles(ctx, id), [".workspace.json", "en.json", "fr.json"]),
      ]);
    },
  },
  {
    id: "complete-workspace-has-no-missing-action",
    title: "a fully translated workspace has no Translate missing action, 0 missing translations and a Translate button that opens the queue",
    entryPoint: "/modules/lang/overview of a complete workspace",
    async run(/** @type {Ctx} */ ctx) {
      const id = freshId(ctx, "complete");
      await seedWorkspace(ctx, id, { locales: ["en", "fr"], keys: { "a.one": { en: "One", fr: "Un" } } });
      const tab = await ctx.tab("admin");
      await tab.signIn("admin");
      await tab.goto(`/modules/lang/overview?workspace=${id}`);
      await ctx.verify("no gap, so no action that names one", [
        tab.shows(/missing translations\s*0/i),
        tab.shows(/average coverage\s*100%/i),
        tab.visible({ role: "link", name: /^Translate \d+ missing in/ }, { hidden: true }),
        tab.visible({ role: "cell", name: "Français fr · complete" }),
      ]);
      await tab.click({ role: "button", name: "Translate" });
      await ctx.verify("Translate opens the queue of that language", [tab.at(/^\/modules\/lang\/language$/), tab.shows(/français is fully translated/i)]);
      await tab.goto(`/modules/lang/overview?workspace=${id}`);
      await tab.click({ role: "button", name: "Edit base texts" });
      await ctx.verify("Edit base texts opens the matrix", [tab.at(/^\/modules\/lang\/translations$/), tab.visible({ role: "button", name: "Open a.one in the panel" })]);
    },
  },
  {
    id: "quick-actions-in-the-command-palette",
    title: "Ctrl K offers Translate missing keys, Add a translation key, Add a language and New translation workspace, and each opens its dialog or page",
    entryPoint: "the command palette",
    async run(/** @type {Ctx} */ ctx) {
      const id = freshId(ctx, "palette");
      await seedWorkspace(ctx, id, { locales: ["en", "fr"], keys: { "a.one": { en: "One" } } });
      const tab = await ctx.tab("admin");
      await tab.signIn("admin");
      await tab.goto(`/modules/lang/overview?workspace=${id}`);
      await tab.press("Control+k");
      await ctx.verify("the four actions are offered", [
        tab.visible({ role: "option", name: "Translate missing keys" }),
        tab.visible({ role: "option", name: "Add a translation key" }),
        tab.visible({ role: "option", name: "Add a language" }),
        tab.visible({ role: "option", name: "New translation workspace" }),
      ]);
      await tab.click({ role: "option", name: "Add a translation key" });
      await ctx.verify("Add a translation key opens the dialog", [tab.visible({ role: "dialog", name: "Add key" })]);
      await tab.goto(`/modules/lang/overview?workspace=${id}&action=add-language`);
      await ctx.verify("the add-language deep link opens the language picker on arrival", [tab.visible({ role: "dialog", name: /Add a language to/ })]);
    },
  },
]);
