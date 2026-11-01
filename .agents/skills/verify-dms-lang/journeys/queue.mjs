import { clickUntil, freshId, guarded, lang, pick, readLocaleFile, seedWorkspace } from "../lang.mjs";

/** @typedef {import("../lang.mjs").Ctx} Ctx */

/**
 * @param {Ctx} ctx The journey
 * @returns {Promise<string>} A workspace where French lacks two of four keys and has one placeholder issue
 */
async function queueWorkspace(ctx) {
  const id = freshId(ctx, "queue");
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

/** The translation queue: one language, one key at a time. */
export const journeys = guarded([
  {
    id: "translate-key-by-key",
    title: "the queue walks the missing keys least complete namespace first, Save & next stores each text, and the last one ends on the done state",
    entryPoint: "/modules/lang/language?locale=fr",
    async run(/** @type {Ctx} */ ctx) {
      const id = await queueWorkspace(ctx);
      const tab = await ctx.tab("admin");
      await tab.signIn("admin");
      await tab.goto(`/modules/lang/language?workspace=${id}&locale=fr`);
      await ctx.verify("the queue shows the base text of the first missing key and what is next", [
        tab.shows(/2 keys left/),
        tab.shows(/auth\.logout/),
        tab.visible({ role: "textbox", name: "Bye" }),
        tab.visible({ role: "button", name: "shop.pay" }),
        tab.visible({ role: "radio", name: "Missing 2" }),
        tab.shows(/Up next\s*shop\.pay\s*Pay \{price\}/i),
        tab.shows(/Up next\s*auth\.logout/i, { not: true }),
      ]);
      await tab.fill({ role: "textbox", name: "Bye" }, "Au revoir");
      await tab.click({ role: "button", name: /Save & next/ });
      await ctx.verify("the next key comes up with its own base text", [tab.shows(/shop\.pay/), tab.visible({ role: "textbox", name: "Pay {price}" }), tab.shows(/1 key left/)]);
      await tab.fill({ role: "textbox", name: "Pay {price}" }, "Payer {price}");
      await tab.press("Control+Enter", { role: "textbox", name: "Pay {price}" });
      await ctx.verify("Ctrl Enter saves the last key and the queue says French is done", [tab.shows(/Français is fully translated|All 4 keys have a value/)]);
      const fr = readLocaleFile(ctx, id, "fr");
      const row = await lang(ctx, "read the key", "GET", `/row?workspace=${id}&key=auth.logout`);
      await ctx.verify("both texts are stored", [
        ctx.equal("French file", fr, { shop: { title: "Boutique", pay: "Payer {price}" }, auth: { login: "Salut {nom}", logout: "Au revoir" } }),
        ctx.equal("the row", pick(row.body, "row", "values"), { en: "Bye", fr: "Au revoir" }),
      ]);
    },
  },
  {
    id: "overflow-menu-makes-base-or-removes",
    title: "the queue's overflow menu makes the language the base after listing the keys it lacks, and removes it only once its code is typed",
    entryPoint: "/modules/lang/language > More actions",
    async run(/** @type {Ctx} */ ctx) {
      const id = await queueWorkspace(ctx);
      const tab = await ctx.tab("admin");
      await tab.signIn("admin");
      await tab.goto(`/modules/lang/language?workspace=${id}&locale=de`);
      await clickUntil(tab, { role: "button", name: "More actions" }, { role: "menu" });
      await tab.click({ role: "menuitem", name: "Remove language" });
      await ctx.verify("removal names the public file and asks for the code", [tab.visible({ role: "dialog", name: /^Remove Deutsch from/ }), tab.shows(new RegExp(`/i18n/${id}/de\\.json`))]);
      await tab.fill({ role: "textbox", name: "Type de to confirm" }, "d");
      await tab.click({ role: "button", name: "Remove language" });
      const kept = await lang(ctx, "read the workspace", "GET", `/workspace?workspace=${id}`);
      await ctx.verify("a wrong code removes nothing", [ctx.equal("locales", pick(kept.body, "locales"), [{ code: "de" }, { code: "en" }, { code: "fr" }])]);
      await tab.fill({ role: "textbox", name: "Type de to confirm" }, "de");
      await tab.click({ role: "button", name: "Remove language" });
      const removed = await lang(ctx, "read the workspace again", "GET", `/workspace?workspace=${id}`);
      await ctx.verify("the typed code removes German", [ctx.equal("locales", pick(removed.body, "locales"), [{ code: "en" }, { code: "fr" }])]);
      await tab.goto(`/modules/lang/language?workspace=${id}&locale=fr`);
      await clickUntil(tab, { role: "button", name: "More actions" }, { role: "menu" });
      await tab.click({ role: "menuitem", name: "Make base language" });
      await ctx.verify("the confirmation lists the keys French lacks", [tab.visible({ role: "dialog", name: "Make Français the base language?" }), tab.shows(/shop\.pay/), tab.shows(/auth\.logout/)]);
      await tab.click({ role: "button", name: "Make base language", within: { role: "dialog" } });
      const based = await lang(ctx, "read the new base", "GET", `/workspace?workspace=${id}`);
      await ctx.verify("French is the base", [ctx.equal("base", pick(based.body, "defaultLocale"), "fr")]);
    },
  },
  {
    id: "skip-and-previous",
    title: "Skip moves on without writing, Previous goes back, and the skipped key is still missing",
    entryPoint: "/modules/lang/language?locale=fr",
    async run(/** @type {Ctx} */ ctx) {
      const id = await queueWorkspace(ctx);
      const tab = await ctx.tab("admin");
      await tab.signIn("admin");
      await tab.goto(`/modules/lang/language?workspace=${id}&locale=fr`);
      await tab.click({ role: "button", name: /^Skip/ });
      await ctx.verify("Skip shows the next key", [tab.shows(/shop\.pay/), tab.visible({ role: "textbox", name: "Pay {price}" })]);
      await tab.click({ role: "button", name: /^Previous/ });
      await ctx.verify("Previous comes back to the skipped key", [tab.shows(/auth\.logout/), tab.visible({ role: "textbox", name: "Bye" })]);
      const flat = await lang(ctx, "read the figures", "GET", `/flat?workspace=${id}`);
      await ctx.verify("nothing was written by skipping", [ctx.equal("missing in French", pick(flat.body, "localeMissing", "fr"), 2)]);
    },
  },
  {
    id: "tabs-and-side-panel",
    title: "the Missing, Issues and All tabs choose the keys, the side panel gives the language's figures, and a namespace scopes the queue",
    entryPoint: "/modules/lang/language?locale=fr",
    async run(/** @type {Ctx} */ ctx) {
      const id = await queueWorkspace(ctx);
      const tab = await ctx.tab("admin");
      await tab.signIn("admin");
      await tab.goto(`/modules/lang/language?workspace=${id}&locale=fr`);
      await ctx.verify("the tabs and the figures of French", [
        tab.visible({ role: "radio", name: "Missing 2" }),
        tab.visible({ role: "radio", name: "Issues 1" }),
        tab.visible({ role: "radio", name: "All 4" }),
        tab.shows(/coverage\s*50%\s*of 4 keys/i),
        tab.shows(/translated\s*2/i),
        tab.shows(/missing\s*2/i),
        tab.shows(/issues\s*1/i),
      ]);
      await tab.click({ role: "radio", name: "Issues 1" });
      await ctx.verify("Issues walks the key whose placeholders differ from the base text", [tab.shows(/auth\.login/), tab.shows(/\{nom\}/)]);
      await tab.click({ role: "radio", name: "Missing 2" });
      await tab.click({ role: "button", name: /^shop 50/ });
      await ctx.verify("a namespace scopes the queue to its own keys", [tab.shows(/1 key left/), tab.shows(/shop\.pay/), tab.visible({ role: "textbox", name: "Pay {price}" })]);
    },
  },
  {
    id: "base-and-unknown-language",
    title: "the base language is edited in the matrix, not in the queue, and an unknown language offers the workspace's own",
    entryPoint: "/modules/lang/language?locale=<code>",
    async run(/** @type {Ctx} */ ctx) {
      const id = await queueWorkspace(ctx);
      const tab = await ctx.tab("admin");
      await tab.signIn("admin");
      await tab.goto(`/modules/lang/language?workspace=${id}&locale=en`);
      await ctx.verify("the base language says so", [tab.shows(/English is the base language/)]);
      await tab.goto(`/modules/lang/language?workspace=${id}&locale=zz`);
      await ctx.verify("an unknown language is named and the workspace's languages are offered", [tab.shows(/zz is not a language of this workspace/), tab.shows(/translate français/i)]);
    },
  },
  {
    id: "escape-then-s-skips",
    title: "Escape leaves the text field, then S skips the key and P goes back; Open in matrix links to the language's gaps",
    entryPoint: "/modules/lang/language keyboard shortcuts",
    async run(/** @type {Ctx} */ ctx) {
      const id = await queueWorkspace(ctx);
      const tab = await ctx.tab("admin");
      await tab.signIn("admin");
      await tab.goto(`/modules/lang/language?workspace=${id}&locale=fr`);
      await tab.press("Escape", { role: "textbox", name: "Bye" });
      await tab.press("s");
      await ctx.verify("S skipped to the next key", [tab.visible({ role: "textbox", name: "Pay {price}" })]);
      await tab.press("Escape", { role: "textbox", name: "Pay {price}" });
      await tab.press("p");
      await ctx.verify("P came back", [tab.visible({ role: "textbox", name: "Bye" })]);
      await tab.click({ role: "link", name: "Open in matrix" });
      await ctx.verify("the matrix opens on the keys French lacks", [tab.at(/^\/modules\/lang\/translations$/), tab.visible({ role: "button", name: "Open shop.pay in the panel" }), tab.visible({ role: "button", name: "Open shop.title in the panel" }, { hidden: true })]);
    },
  },
]);
