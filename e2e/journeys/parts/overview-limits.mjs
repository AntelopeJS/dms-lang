import { currentUrl, rowsOrder } from "../../files.mjs";
import { freshId, lang, seedWorkspace } from "../../lang.mjs";

/** @typedef {import("../../lang.mjs").Ctx} Ctx */

const HEATMAP_LINK = /^\w+ · .+: /;

/** The Overview's heatmap limit, the order of its language rows and who gets the Add language action. */
export const limitJourneys = [
  {
    id: "heatmap-shows-six-by-six-and-links-to-the-matrix",
    title: "the heatmap shows at most six namespaces and six languages and then offers See all in the matrix; a smaller workspace hides nothing",
    entryPoint: "/modules/lang/overview",
    async run(/** @type {Ctx} */ ctx) {
      const big = freshId(ctx, "heat");
      /** @type {Record<string, Record<string, string>>} */
      const messages = { en: {} };
      const targets = ["fr", "de", "es", "it", "pt", "nl", "sv"];
      for (const code of targets) messages[code] = {};
      for (let n = 0; n < 8; n += 1) {
        for (const code of ["en", ...targets]) {
          const tree = (messages[code] ??= {});
          tree[`ns${n}`] = { k0: `${code} ${n}`, k1: `${code} ${n} bis` };
        }
      }
      for (const code of targets) messages[code] ??= {};
      await lang(ctx, "import 8 namespaces in 8 languages", "POST", "/import", { format: "dms-lang.workspace", version: 1, id: big, defaultLocale: "en", locales: ["en", ...targets].map((code) => ({ code })), messages });
      const small = freshId(ctx, "small");
      await seedWorkspace(ctx, small, { locales: ["en", "fr", "de"], keys: { "a.one": { en: "One" }, "b.one": { en: "One" } } });
      const tab = await ctx.tab("admin");
      await tab.signIn("admin");
      await tab.goto(`/modules/lang/overview?workspace=${big}`);
      await ctx.verify("8 namespaces and 7 target languages show as 6 by 6 cells and a link to the rest", [
        tab.count({ role: "link", name: HEATMAP_LINK }, 36),
        tab.visible({ role: "link", name: "See all in the matrix" }),
      ]);
      await tab.click({ role: "link", name: "See all in the matrix" });
      await ctx.verify("the link opens the matrix", [tab.at(/^\/modules\/lang\/translations$/)]);
      await tab.goto(`/modules/lang/overview?workspace=${small}`);
      await ctx.verify("2 namespaces and 2 languages show all 4 cells and no link", [
        tab.count({ role: "link", name: HEATMAP_LINK }, 4),
        tab.visible({ role: "link", name: "See all in the matrix" }, { hidden: true }),
      ]);
    },
  },
  {
    id: "heatmap-cell-without-gaps-opens-the-namespace",
    title: "a heatmap cell of a complete language opens the matrix on its namespace without the missing filter",
    entryPoint: "/modules/lang/overview > a heatmap cell",
    async run(/** @type {Ctx} */ ctx) {
      const id = freshId(ctx, "whole");
      await seedWorkspace(ctx, id, { locales: ["en", "fr", "de"], keys: { "shop.title": { en: "Shop", fr: "Boutique", de: "Laden" }, "auth.login": { en: "In", fr: "Entrer" } } });
      const tab = await ctx.tab("admin");
      await tab.signIn("admin");
      await tab.goto(`/modules/lang/overview?workspace=${id}`);
      await tab.click({ role: "link", name: /^shop · Français: all translated/ });
      await ctx.verify("the matrix opens on shop with every status, not only the missing keys", [
        tab.at(/^\/modules\/lang\/translations$/),
        ctx.holds("namespace without a filter", /namespace=shop/.test(currentUrl(tab)) && !/filter=missing/.test(currentUrl(tab)), currentUrl(tab)),
        tab.visible({ role: "button", name: "Open shop.title in the panel" }),
        tab.visible({ role: "button", name: "Open auth.login in the panel" }, { hidden: true }),
      ]);
    },
  },
  {
    id: "languages-rank-the-base-first-then-least-complete",
    title: "the languages table pins the base language on top and lists the others least complete first",
    entryPoint: "/modules/lang/overview > Languages",
    async run(/** @type {Ctx} */ ctx) {
      const id = freshId(ctx, "rank");
      await seedWorkspace(ctx, id, {
        locales: ["en", "de", "es", "fr"],
        keys: { "a.one": { en: "One", es: "Uno", fr: "Un" }, "a.two": { en: "Two", es: "Dos" }, "a.three": { en: "Three", es: "Tres", fr: "Trois" } },
      });
      const tab = await ctx.tab("admin");
      await tab.signIn("admin");
      await tab.goto(`/modules/lang/overview?workspace=${id}`);
      await ctx.verify("English first, then Deutsch (0%), Français (66%), Español (100%)", [
        tab.visible({ role: "cell", name: "English base en · 3 strings" }),
        ...(await rowsOrder(tab, "Languages · least complete first", ["English", "Deutsch", "Français", "Español"]).then((order) => [{ name: "order", pass: order === "English|Deutsch|Français|Español", detail: order }])),
      ]);
    },
  },
  {
    id: "add-language-belongs-to-created-editable-workspaces",
    title: "the Add language action and an Editable scope bar show on a workspace you created, not on the project files or the installed modules (Read-only)",
    entryPoint: "/modules/lang/overview",
    async run(/** @type {Ctx} */ ctx) {
      const id = freshId(ctx, "own");
      await seedWorkspace(ctx, id, { locales: ["en", "fr"], keys: { "a.b": { en: "Hello" } } });
      const tab = await ctx.tab("admin");
      await tab.signIn("admin");
      await tab.goto(`/modules/lang/overview?workspace=${id}`);
      await ctx.verify("a created workspace is editable and offers Add language", [tab.visible({ role: "link", name: "Add language" }), tab.shows(/Editable/), tab.shows(/2 languages/), tab.shows(/1 key\b/)]);
      await tab.goto("/modules/lang/overview?workspace=default");
      await ctx.verify("the project files offer no Add language", [tab.visible({ role: "link", name: "Add language" }, { hidden: true })]);
      await tab.goto("/modules/lang/overview?workspace=modules");
      await ctx.verify("the installed modules are Read-only and offer no Add language", [tab.shows(/Read-only/), tab.visible({ role: "link", name: "Add language" }, { hidden: true })]);
    },
  },
  {
    id: "a-workspace-without-keys-shows-its-first-steps",
    title: "a workspace you created with no key yet shows its first steps in place of figures and a heatmap",
    entryPoint: "/modules/lang/overview",
    async run(/** @type {Ctx} */ ctx) {
      const id = freshId(ctx, "fresh");
      await seedWorkspace(ctx, id, { locales: ["en"] });
      const tab = await ctx.tab("admin");
      await tab.signIn("admin");
      await tab.goto(`/modules/lang/overview?workspace=${id}`);
      await ctx.verify("the steps are shown and the heatmap is not", [
        tab.shows(new RegExp(`${id} is ready to translate`)),
        tab.shows(/Add your first keys/),
        tab.shows(/Add a language to translate into/),
        tab.visible({ role: "link", name: "Add first key" }),
        tab.visible({ role: "button", name: "Add language" }),
        tab.visible({ role: "link", name: HEATMAP_LINK }, { hidden: true }),
      ]);
      await tab.click({ role: "link", name: "Add first key" });
      await ctx.verify("Add first key opens the dialog in the matrix", [tab.at(/^\/modules\/lang\/translations$/), tab.visible({ role: "dialog", name: "Add key" })]);
    },
  },
];

