import { fieldValue, freshId, lang, pick, seedWorkspace } from "../../lang.mjs";

/** @typedef {import("../../lang.mjs").Ctx} Ctx */

/**
 * @param {Ctx} ctx The journey
 * @returns {Promise<string>} A workspace where French lacks two of four keys and has one placeholder issue
 */
async function queueWorkspace(ctx) {
  const id = freshId(ctx, "qm");
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

/** What the queue asks before it saves, what it keeps, and what it offers at the end of a pass. */
export const moreQueueJourneys = [
  {
    id: "a-draft-with-issues-needs-a-second-press",
    title: "a draft that uses a variable the base text lacks is saved on the second press, a broken one is not saved, and clearing a text asks first",
    entryPoint: "/modules/lang/language?locale=fr",
    async run(/** @type {Ctx} */ ctx) {
      const id = await queueWorkspace(ctx);
      const tab = await ctx.tab("admin");
      await tab.signIn("admin");
      await tab.goto(`/modules/lang/language?workspace=${id}&locale=fr`);
      await tab.fill({ role: "textbox", name: "Bye" }, "Au revoir {nom}");
      await tab.click({ role: "button", name: /Save & next|Save anyway/ });
      const first = await lang(ctx, "read the key after one press", "GET", `/row?workspace=${id}&key=auth.logout`);
      await ctx.verify("the first press saves nothing and says to press again", [tab.shows(/Press Save again to save it anyway/), ctx.equal("values", pick(first.body, "row", "values"), { en: "Bye" })]);
      await tab.click({ role: "button", name: /Save anyway|Save & next/ });
      const second = await lang(ctx, "read the key after two presses", "GET", `/row?workspace=${id}&key=auth.logout`);
      await ctx.verify("the second press saves it", [ctx.equal("values", pick(second.body, "row", "values"), { en: "Bye", fr: "Au revoir {nom}" })]);
      await tab.goto(`/modules/lang/language?workspace=${id}&locale=fr&mode=all&key=shop.title`);
      await tab.fill({ role: "textbox", name: "Shop" }, "");
      await tab.click({ role: "button", name: /Save & next/ });
      await ctx.verify("clearing a saved text asks first", [tab.visible({ role: "dialog", name: "Clear the Français text of shop.title?" })]);
      const kept = await lang(ctx, "read the key", "GET", `/row?workspace=${id}&key=shop.title`);
      await ctx.verify("nothing is cleared before the answer", [ctx.equal("values", pick(kept.body, "row", "values", "fr"), "Boutique")]);
    },
  },
  {
    id: "drafts-survive-a-language-switch",
    title: "a text typed and not saved is still there after going to another language and back",
    entryPoint: "/modules/lang/language",
    async run(/** @type {Ctx} */ ctx) {
      const id = await queueWorkspace(ctx);
      const tab = await ctx.tab("admin");
      await tab.signIn("admin");
      await tab.goto(`/modules/lang/language?workspace=${id}&locale=fr`);
      await tab.fill({ role: "textbox", name: "Bye" }, "Au revoir, brouillon");
      await tab.click({ role: "button", name: "Change language" });
      await tab.click({ role: "menuitem", name: /Deutsch/ });
      await ctx.verify("the queue now works on German", [tab.shows(/Deutsch/), tab.visible({ role: "textbox", name: "Hello {name}" })]);
      await tab.click({ role: "button", name: "Change language" });
      await tab.click({ role: "menuitem", name: /Français/ });
      await ctx.verify("the French draft is back in its field", [ctx.equal("draft", await fieldValue(tab, { role: "textbox", name: "Bye" }), "Au revoir, brouillon")]);
      const row = await lang(ctx, "read the key", "GET", `/row?workspace=${id}&key=auth.logout`);
      await ctx.verify("it was never saved", [ctx.equal("values", pick(row.body, "row", "values"), { en: "Bye" })]);
    },
  },
  {
    id: "skipped-keys-come-back-and-the-end-offers-more",
    title: "skipped keys come back once the others are done, and a finished pass offers to review the issues",
    entryPoint: "/modules/lang/language?locale=fr",
    async run(/** @type {Ctx} */ ctx) {
      const id = await queueWorkspace(ctx);
      const tab = await ctx.tab("admin");
      await tab.signIn("admin");
      await tab.goto(`/modules/lang/language?workspace=${id}&locale=fr`);
      await tab.click({ role: "button", name: /^Skip/ });
      await ctx.verify("Skip moves to the next key and counts the skipped one", [tab.visible({ role: "textbox", name: "Pay {price}" }), tab.shows(/1 skipped/)]);
      await tab.fill({ role: "textbox", name: "Pay {price}" }, "Payer {price}");
      await tab.click({ role: "button", name: /Save & next/ });
      await ctx.verify("with the others done, the skipped key comes back", [tab.visible({ role: "textbox", name: "Bye" }), tab.shows(/Back to the skipped keys|last key left/)]);
      await tab.fill({ role: "textbox", name: "Bye" }, "Au revoir");
      await tab.click({ role: "button", name: /Save & next/ });
      await ctx.verify("the pass ends and offers the issue to review", [tab.shows(/Français is fully translated|All 4 keys have a value/), tab.visible({ role: "button", name: /Review issues \(1\)/ })]);
    },
  },
  {
    id: "a-namespace-the-language-lacks-leaves-the-url",
    title: "a queue link naming a namespace that does not exist walks every key",
    entryPoint: "/modules/lang/language?namespace=nope",
    async run(/** @type {Ctx} */ ctx) {
      const id = await queueWorkspace(ctx);
      const tab = await ctx.tab("admin");
      await tab.signIn("admin");
      await tab.goto(`/modules/lang/language?workspace=${id}&locale=fr&namespace=nope`);
      await ctx.verify("both missing keys are left and no namespace scope is shown", [tab.shows(/2 keys left/), tab.visible({ role: "button", name: /^Show every namespace instead of/ }, { hidden: true })]);
    },
  },
  {
    id: "the-queue-says-what-is-wrong-with-a-draft",
    title: "while a draft is typed the queue names each problem: a variable left out, one the base lacks, a space at an end, a lone @, an unclosed brace and another number of plural forms",
    entryPoint: "/modules/lang/language?locale=fr",
    async run(/** @type {Ctx} */ ctx) {
      const id = await queueWorkspace(ctx);
      const tab = await ctx.tab("admin");
      await tab.signIn("admin");
      await tab.goto(`/modules/lang/language?workspace=${id}&locale=fr&mode=all&key=shop.pay`);
      const field = { role: "textbox", name: "Pay {price}" };
      /** @type {[string, string, RegExp][]} */
      const drafts = [
        ["a renamed variable", "Payer {prix}", /\{price\} missing/],
        ["a variable the base lacks", "Payer {price} {prix}", /\{prix\} is not in the base text/],
        ["a trailing space", "Payer {price} ", /Space or line break at the start or end: it shows in the app/],
        ["a lone at sign", "Payer {price} jane@example.com", /A lone @ breaks the message/],
        ["an unclosed brace", "Payer {price} {oops", /is never closed/],
        ["another number of plural forms", "Payer {price} | encore", /2 plural forms, the base has 1/],
      ];
      for (const [label, text, sentence] of drafts) {
        await tab.fill(field, text);
        await ctx.verify(`${label} is named`, [tab.shows(sentence)]);
      }
    },
  },
];

