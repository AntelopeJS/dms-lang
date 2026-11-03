import { currentUrl, downloadOf } from "../../files.mjs";
import { fieldValue, freshId, lang, pick, readLocaleFile, seedWorkspace } from "../../lang.mjs";

/** @typedef {import("../../lang.mjs").Ctx} Ctx */

/**
 * @param {Ctx} ctx The journey
 * @returns {Promise<string>} A workspace where French lacks two of four keys and has one placeholder issue
 */
async function queueWorkspace(ctx) {
  const id = freshId(ctx, "qk");
  await seedWorkspace(ctx, id, {
    locales: ["en", "fr", "de"],
    keys: {
      "shop.title": { en: "Shop", fr: "Boutique", de: "Laden" },
      "shop.pay": { en: "Pay {price}", de: "Zahle {price}" },
      "auth.login": { en: "Hello {name}", fr: "Salut {nom}" },
      "auth.logout": { en: "Bye" },
    },
  });
  return id;
}

/** The queue's Ctrl S, its deep links and the matrix link of its header. */
export const queueKeyJourneys = [
  {
    id: "ctrl-s-saves-and-stays",
    title: "Ctrl S saves the text and stays on the key",
    entryPoint: "/modules/lang/language?locale=fr",
    async run(/** @type {Ctx} */ ctx) {
      const id = await queueWorkspace(ctx);
      const tab = await ctx.tab("admin");
      await tab.signIn("admin");
      await tab.goto(`/modules/lang/language?workspace=${id}&locale=fr`);
      await tab.fill({ role: "textbox", name: "Bye" }, "Au revoir");
      await tab.press("Control+s", { role: "textbox", name: "Bye" });
      const saved = await lang(ctx, "read the key", "GET", `/row?workspace=${id}&key=auth.logout`);
      await ctx.verify("the text is stored and the queue stays on the key, with the text in its field", [
        ctx.equal("values", pick(saved.body, "row", "values"), { en: "Bye", fr: "Au revoir" }),
        ctx.equal("file", readLocaleFile(ctx, id, "fr"), { shop: { title: "Boutique" }, auth: { login: "Salut {nom}", logout: "Au revoir" } }),
        tab.shows(/auth\.logout/),
        ctx.equal("the field", await fieldValue(tab, { role: "textbox", name: "Bye" }), "Au revoir"),
        tab.visible({ role: "textbox", name: "Pay {price}" }, { hidden: true }),
      ]);
    },
  },
  {
    id: "queue-deep-links",
    title: "a queue URL without a language asks for one, mode= picks the keys walked, key= starts on a key and namespace= scopes the queue",
    entryPoint: "/modules/lang/language?locale=&mode=&key=&namespace=",
    async run(/** @type {Ctx} */ ctx) {
      const id = await queueWorkspace(ctx);
      const tab = await ctx.tab("admin");
      await tab.signIn("admin");
      await tab.goto(`/modules/lang/language?workspace=${id}`);
      await ctx.verify("no language: the languages to translate are offered, the base is not", [
        tab.shows(/Choose a language to translate/),
        tab.visible({ role: "link", name: "Translate Français" }),
        tab.visible({ role: "link", name: "Translate Deutsch" }),
        tab.visible({ role: "link", name: "Translate English" }, { hidden: true }),
      ]);
      await tab.goto(`/modules/lang/language?workspace=${id}&locale=fr&mode=issues`);
      await ctx.verify("mode=issues walks the key whose placeholders differ", [tab.shows(/1 key left/), tab.shows(/auth\.login/), tab.visible({ role: "textbox", name: "Hello {name}" })]);
      await tab.goto(`/modules/lang/language?workspace=${id}&locale=fr&mode=all`);
      await ctx.verify("mode=all walks every key", [tab.shows(/4 keys left/)]);
      await tab.goto(`/modules/lang/language?workspace=${id}&locale=fr&mode=all&key=shop.pay`);
      await ctx.verify("key= starts the queue on that key", [tab.shows(/shop\.pay/), tab.visible({ role: "textbox", name: "Pay {price}" })]);
      await tab.goto(`/modules/lang/language?workspace=${id}&locale=fr&namespace=shop`);
      await ctx.verify("namespace= keeps the keys of that namespace", [tab.shows(/1 key left/), tab.visible({ role: "textbox", name: "Pay {price}" }), tab.visible({ role: "button", name: "Show every namespace instead of shop" })]);
    },
  },
  {
    id: "open-in-matrix-keeps-the-namespace",
    title: "Open in matrix filters on the keys the language lacks, in the namespace the queue is scoped to; on the base language it opens that namespace unfiltered",
    entryPoint: "/modules/lang/language > Open in matrix",
    async run(/** @type {Ctx} */ ctx) {
      const id = await queueWorkspace(ctx);
      const tab = await ctx.tab("admin");
      await tab.signIn("admin");
      await tab.goto(`/modules/lang/language?workspace=${id}&locale=fr&namespace=shop`);
      await tab.click({ role: "link", name: "Open in matrix" });
      await ctx.verify("the matrix lists French's gap of the shop namespace only", [
        tab.at(/^\/modules\/lang\/translations$/),
        ctx.holds("the URL names the namespace, the filter and the language", /namespace=shop/.test(currentUrl(tab)) && /filter=missing/.test(currentUrl(tab)) && /missingIn=fr/.test(currentUrl(tab)), currentUrl(tab)),
        tab.visible({ role: "button", name: "Open shop.pay in the panel" }),
        tab.visible({ role: "button", name: "Open shop.title in the panel" }, { hidden: true }),
        tab.visible({ role: "button", name: "Open auth.logout in the panel" }, { hidden: true }),
      ]);
      await tab.goto(`/modules/lang/language?workspace=${id}&locale=en&namespace=shop`);
      await tab.click({ role: "link", name: "Open in matrix", nth: 0 });
      await ctx.verify("on the base language the matrix opens the namespace with no status filter", [
        tab.at(/^\/modules\/lang\/translations$/),
        ctx.holds("namespace and no filter", /namespace=shop/.test(currentUrl(tab)) && !/filter=missing/.test(currentUrl(tab)), currentUrl(tab)),
        tab.visible({ role: "button", name: "Open shop.title in the panel" }),
        tab.visible({ role: "button", name: "Open shop.pay in the panel" }),
        tab.visible({ role: "button", name: "Open auth.login in the panel" }, { hidden: true }),
      ]);
    },
  },
  {
    id: "download-the-language-file",
    title: "Download <code>.json saves the messages of the language, and removing a language offers the same file first",
    entryPoint: "/modules/lang/language > Download fr.json",
    async run(/** @type {Ctx} */ ctx) {
      const id = await queueWorkspace(ctx);
      const tab = await ctx.tab("admin");
      await tab.signIn("admin");
      await tab.goto(`/modules/lang/language?workspace=${id}&locale=fr`);
      const file = await downloadOf(ctx, tab, { role: "button", name: "Download fr.json" });
      /** @type {unknown} */
      let saved = null;
      try {
        saved = JSON.parse(file?.text ?? "");
      } catch {
        saved = null;
      }
      await ctx.verify("the file is fr.json and holds the translated keys as a tree", [
        ctx.equal("file name", file?.name, "fr.json"),
        ctx.equal("messages", saved, { shop: { title: "Boutique" }, auth: { login: "Salut {nom}" } }),
      ]);
      await tab.goto(`/modules/lang/language?workspace=${id}&locale=de`);
      await tab.click({ role: "button", name: "More actions" });
      await tab.click({ role: "menuitem", name: "Remove language" });
      await ctx.verify("the removal dialog offers to download the file first", [tab.visible({ role: "dialog", name: /^Remove / }), tab.visible({ role: "button", name: "Download de.json" })]);
    },
  },
];
