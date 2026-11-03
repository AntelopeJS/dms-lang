import { currentUrl, labelsOf, leadingNames, linkTexts, namesInOrder, radioChecked } from "../../files.mjs";
import { clickUntil, fieldValue, freshId, lang, list, pick, seedWorkspace } from "../../lang.mjs";

/** @typedef {import("../../lang.mjs").Ctx} Ctx */

const open = (/** @type {string} */ key) => ({ role: "button", name: `Open ${key} in the panel` });

export const roundElevenMatrix = [
  {
    id: "command-key-works-like-control-in-a-cell",
    title: "in a cell Command Enter saves and stays on the cell, and Command Shift Enter opens the key panel with the typed text",
    entryPoint: "/modules/lang/translations > a cell",
    async run(/** @type {Ctx} */ ctx) {
      const id = freshId(ctx, "meta");
      await seedWorkspace(ctx, id, { locales: ["en", "fr"], keys: { "a.one": { en: "One" }, "a.two": { en: "Two" } } });
      const tab = await ctx.tab("admin");
      await tab.signIn("admin");
      await tab.goto(`/modules/lang/translations?workspace=${id}`);
      await tab.click({ role: "button", name: "Translate a.one into Français" });
      await tab.fill({ role: "textbox", name: "Translate a.one into Français" }, "Neu");
      await tab.press("Meta+Enter", { role: "textbox", name: "Translate a.one into Français" });
      const saved = await lang(ctx, "read the key", "GET", `/row?workspace=${id}&key=a.one`);
      await ctx.verify("Meta Enter saved the text and no other cell opened", [ctx.equal("values", pick(saved.body, "row", "values"), { en: "One", fr: "Neu" }), tab.visible({ role: "textbox", name: "Translate a.two into Français" }, { hidden: true })]);
      await tab.click({ role: "button", name: "Translate a.two into Français" });
      await tab.fill({ role: "textbox", name: "Translate a.two into Français" }, "Zwei, ungespeichert");
      await tab.press("Meta+Shift+Enter", { role: "textbox", name: "Translate a.two into Français" });
      await ctx.verify("Meta Shift Enter opens the panel with the typed text, saved nowhere", [
        tab.visible({ role: "heading", name: "a.two" }),
        ctx.equal("the panel field", await fieldValue(tab, { role: "textbox", name: "Français" }), "Zwei, ungespeichert"),
        ctx.equal("nothing written", pick((await lang(ctx, "read the second key", "GET", `/row?workspace=${id}&key=a.two`)).body, "row", "values"), { en: "Two" }),
      ]);
    },
  },
  {
    id: "outdated-translations-are-issues",
    title: "a translation made from an older base text counts under Issues in the matrix and the queue, and goes to 0 once marked reviewed",
    entryPoint: "/modules/lang/translations?filter=issues",
    async run(/** @type {Ctx} */ ctx) {
      const id = freshId(ctx, "stale");
      await seedWorkspace(ctx, id, { locales: ["en", "fr"], keys: { "a.b": { en: "Hello", fr: "Salut" }, "a.c": { en: "Fine", fr: "Bien" } } });
      await lang(ctx, "change the base text", "PUT", "/key", { workspace: id, path: "a.b", values: { en: "Hello there" } });
      const tab = await ctx.tab("admin");
      await tab.signIn("admin");
      await tab.goto(`/modules/lang/translations?workspace=${id}`);
      await ctx.verify("the matrix counts one issue", [tab.visible({ role: "radio", name: "Issues 1" })]);
      await tab.goto(`/modules/lang/translations?workspace=${id}&filter=issues`);
      await ctx.verify("and lists the key", [tab.visible(open("a.b")), tab.visible(open("a.c"), { hidden: true })]);
      await tab.goto(`/modules/lang/language?workspace=${id}&locale=fr`);
      await ctx.verify("the queue's tab and card count it too", [tab.visible({ role: "radio", name: "Issues 1" }), tab.shows(/issues\s*1/i)]);
      await lang(ctx, "mark it reviewed", "POST", "/key/reviewed", { workspace: id, path: "a.b", locales: ["fr"] });
      await tab.goto(`/modules/lang/language?workspace=${id}&locale=fr`);
      await ctx.verify("reviewed: no issue left in the queue", [tab.visible({ role: "radio", name: "Issues 0" })]);
      await tab.goto(`/modules/lang/translations?workspace=${id}`);
      await ctx.verify("nor in the matrix", [tab.visible({ role: "radio", name: "Issues 0" })]);
    },
  },
  {
    id: "translate-into-switches-to-missing",
    title: "picking a language in Translate into switches the status tab to Missing, with the radio checked and filter=missing in the URL",
    entryPoint: "/modules/lang/translations",
    async run(/** @type {Ctx} */ ctx) {
      const id = freshId(ctx, "into");
      await seedWorkspace(ctx, id, { locales: ["en", "fr", "de"], keys: { "a.one": { en: "One", fr: "Un" }, "a.two": { en: "Two", de: "Zwei" } } });
      const tab = await ctx.tab("admin");
      await tab.signIn("admin");
      await tab.goto(`/modules/lang/translations?workspace=${id}`);
      await ctx.verify("to begin with, the All tab is checked", [ctx.equal("All checked", await radioChecked(tab, /^All \d+$/), true)]);
      await clickUntil(tab, { role: "combobox", name: "Translate into" }, { role: "option", name: /Deutsch/ });
      await tab.click({ role: "option", name: /Deutsch/ });
      await ctx.verify("the incomplete tab is checked and the URL filters on the missing keys", [
        ctx.equal("Missing checked", await radioChecked(tab, /^(Missing|Incomplete) \d+$/), true),
        ctx.holds("URL", /filter=missing/.test(currentUrl(tab)) && /missingIn=de/.test(currentUrl(tab)), currentUrl(tab)),
        tab.visible(open("a.one")),
        tab.visible(open("a.two"), { hidden: true }),
      ]);
    },
  },
  {
    id: "module-texts-count-as-translated",
    title: "in the project files a key shown From a module is translated: it stays out of the incomplete count",
    entryPoint: "/modules/lang/translations?workspace=default",
    async run(/** @type {Ctx} */ ctx) {
      const flat = await lang(ctx, "read the project files", "GET", "/flat?workspace=default");
      await lang(ctx, "override a module text in French only", "PUT", "/key", { workspace: "default", path: "dms.button.save_changes", values: { fr: "Enregistrer mes changements" } });
      const after = await lang(ctx, "read them again", "GET", "/flat?workspace=default");
      const tab = await ctx.tab("admin");
      await tab.signIn("admin");
      await tab.goto("/modules/lang/translations?workspace=default");
      const incomplete = Number(pick(after.body, "incompleteKeys"));
      await ctx.verify("the server and the page agree: the key adds nothing to the incomplete count", [
        ctx.equal("server", incomplete, Number(pick(flat.body, "incompleteKeys"))),
        tab.visible({ role: "radio", name: new RegExp(`^(Incomplete|Missing) ${incomplete}$`) }),
        tab.visible(open("dms.button.save_changes")),
      ]);
      await lang(ctx, "drop the override", "DELETE", "/key/override", { workspace: "default", path: "dms.button.save_changes", locales: ["fr"] });
    },
  },
  {
    id: "counts-keep-the-regional-number-format",
    title: "1,234 keys read 1,234 in the matrix footer, the key panel's place and the overview",
    entryPoint: "/modules/lang/translations, /overview",
    async run(/** @type {Ctx} */ ctx) {
      const id = freshId(ctx, "big");
      /** @type {Record<string, string>} */
      const en = {};
      for (let n = 0; n < 1234; n += 1) en[`k${String(n).padStart(4, "0")}`] = `T${n}`;
      await lang(ctx, "import 1234 keys", "POST", "/import", { format: "dms-lang.workspace", version: 1, id, defaultLocale: "en", locales: [{ code: "en" }, { code: "fr" }], messages: { en: { all: en }, fr: { all: {} } } });
      const tab = await ctx.tab("admin");
      await tab.signIn("admin");
      await tab.goto(`/modules/lang/translations?workspace=${id}`);
      await ctx.verify("the footer counts 1,234 incomplete keys", [tab.shows(/1,234 incomplete keys/)]);
      await tab.goto(`/modules/lang/translations?workspace=${id}&key=all.k0000`);
      await ctx.verify("the panel's place reads 1 of 1,234", [tab.shows(/1 of 1,234/)]);
      await tab.goto(`/modules/lang/overview?workspace=${id}`);
      await ctx.verify("the overview reads 1,234 keys", [tab.shows(/1,234 keys/)]);
    },
  },
];

export const roundElevenQueue = [
  {
    id: "the-finished-pass-offers-the-least-complete-language",
    title: "when a language is done the queue offers the least complete other language first, and an unknown language lists them in that order",
    entryPoint: "/modules/lang/language?locale=fr",
    async run(/** @type {Ctx} */ ctx) {
      const id = freshId(ctx, "next");
      await seedWorkspace(ctx, id, {
        locales: ["en", "fr", "de", "es"],
        keys: { "a.x": { en: "X", fr: "x", de: "x" }, "a.y": { en: "Y", fr: "y", de: "y" }, "a.z": { en: "Z", fr: "z" }, "a.w": { en: "W", fr: "w" } },
      });
      const tab = await ctx.tab("admin");
      await tab.signIn("admin");
      await tab.goto(`/modules/lang/language?workspace=${id}&locale=fr`);
      await ctx.verify("French is done and the next language is Español, the emptiest", [tab.shows(/Continue with Español · 4 missing/)]);
      await tab.goto(`/modules/lang/language?workspace=${id}&locale=xx`);
      await ctx.verify("the suggestions are Español, Deutsch, Français", [ctx.equal("order", await linkTexts(tab, /^Translate /), "Translate Español|Translate Deutsch|Translate Français")]);
    },
  },
];

export const roundElevenOverview = [
  {
    id: "the-base-language-is-left-out-of-the-figures",
    title: "the Missing translations card and Average coverage count only the languages other than the base, and the Keys card names the keys without a base text",
    entryPoint: "/modules/lang/overview",
    async run(/** @type {Ctx} */ ctx) {
      const id = freshId(ctx, "nobase");
      await seedWorkspace(ctx, id, { locales: ["en", "fr"], keys: { "a.x": { fr: "x" }, "a.y": { en: "Y" } } });
      const kpis = await lang(ctx, "read the figures", "GET", `/kpis?workspace=${id}`);
      const item = (/** @type {string} */ name) => list(kpis.body, "items").find((entry) => entry.id === name);
      const coverage = pick(item("coverage"), "value", "params", "value", "value");
      await ctx.verify("the API: 1 missing, 50% average, a warning about the key without base text", [
        ctx.equal("missing", item("missing")?.value, 1),
        ctx.equal("coverage", coverage, 0.5),
        ctx.equal("keys detail", pick(item("keys"), "detail", "key"), "dms_lang.kpis.keys_detail_base_missing"),
        ctx.equal("tone", item("keys")?.detailTone, "warning"),
      ]);
      const tab = await ctx.tab("admin");
      await tab.signIn("admin");
      await tab.goto(`/modules/lang/overview?workspace=${id}`);
      await ctx.verify("the page reads the same", [tab.shows(/missing translations\s*1\b/i), tab.shows(/average coverage\s*50%/i), tab.shows(/1 key without base text/i)]);
    },
  },
  {
    id: "language-tiles-carry-the-region-only-when-shared",
    title: "the overview's language rows read Français (Belgique) next to a sibling French and plain Français when fr-BE is alone",
    entryPoint: "/modules/lang/overview",
    async run(/** @type {Ctx} */ ctx) {
      const shared = freshId(ctx, "tiles");
      const alone = freshId(ctx, "tile");
      await seedWorkspace(ctx, shared, { locales: ["en", "fr", "fr-BE"], keys: { "a.b": { en: "x" } } });
      await seedWorkspace(ctx, alone, { locales: ["en", "fr-BE"], keys: { "a.b": { en: "x" } } });
      const tab = await ctx.tab("admin");
      await tab.signIn("admin");
      await tab.goto(`/modules/lang/overview?workspace=${shared}`);
      await ctx.verify("shared: the region is named in the row", [tab.visible({ role: "cell", name: /^Français \(Belgique\) fr-BE · / }), tab.visible({ role: "cell", name: /^Français fr · / })]);
      await tab.goto(`/modules/lang/overview?workspace=${alone}`);
      await ctx.verify("alone: plain Français", [tab.visible({ role: "cell", name: /^Français fr-BE · / }), tab.visible({ role: "cell", name: /Belgique/ }, { hidden: true })]);
    },
  },
];

export const roundElevenOrder = [
  {
    id: "heatmap-and-queue-lists-are-least-complete-first",
    title: "the heatmap's language columns, the queue's namespace list and the Workspaces cards follow the order the docs name, and the heatmap leaves the base language out",
    entryPoint: "/modules/lang/overview, /language, /workspaces",
    async run(/** @type {Ctx} */ ctx) {
      const id = freshId(ctx, "order");
      await seedWorkspace(ctx, id, {
        locales: ["en", "fr", "de", "es"],
        keys: { "alpha.a": { en: "A", fr: "a", de: "a", es: "a" }, "alpha.b": { en: "B", fr: "b", de: "b" }, "beta.a": { en: "A" }, "beta.b": { en: "B" }, "gamma.a": { en: "A", fr: "a" }, "gamma.b": { en: "B" } },
      });
      const tab = await ctx.tab("admin");
      await tab.signIn("admin");
      await tab.goto(`/modules/lang/overview?workspace=${id}`);
      await tab.visible({ role: "link", name: /^alpha · / });
      await ctx.verify("the columns run Español (50%), Deutsch (66%), Français (100%) and never English", [
        ctx.holds("order", /Español.*Deutsch.*Français/.test(await labelsOf(tab, "link", /^alpha · /)), await labelsOf(tab, "link", /^alpha · /)),
        tab.visible({ role: "link", name: /· English: / }, { hidden: true }),
      ]);
      await tab.goto(`/modules/lang/language?workspace=${id}&locale=fr`);
      await tab.visible({ role: "button", name: /^beta \d/ });
      await ctx.verify("the queue's namespaces run beta, gamma, alpha", [ctx.equal("order", await leadingNames(tab, /^(alpha|beta|gamma) \d/), "beta|gamma|alpha")]);
      await tab.goto("/modules/lang/workspaces");
      await ctx.verify("the cards run Project files, the workspaces you created, Installed modules", [ctx.equal("order", await namesInOrder(tab, "heading", ["Project files", id, "Installed modules"]), `Project files|${id}|Installed modules`)]);
    },
  },
];
