import { MAC_USER_AGENT, pretendToBeAMac, scopeBarText, textOf } from "../../files.mjs";
import { fieldValue, freshId, lang, pick, seedWorkspace } from "../../lang.mjs";

/** @typedef {import("../../lang.mjs").Ctx} Ctx */

export const roundTwelveSettings = [
  {
    id: "delete-dialog-names-the-url-that-stops-responding",
    title: "the Delete dialog lists the public URL that stops responding, next to the files and the strings it removes",
    entryPoint: "/modules/lang/workspace > Danger zone > Delete…",
    async run(/** @type {Ctx} */ ctx) {
      const id = freshId(ctx, "gone");
      await seedWorkspace(ctx, id, { locales: ["en", "fr"], keys: { "a.b": { en: "Hello", fr: "Salut" } } });
      const tab = await ctx.tab("admin");
      await tab.signIn("admin");
      await tab.goto(`/modules/lang/workspace?workspace=${id}`);
      await tab.click({ role: "button", name: "Delete…" });
      await tab.visible({ role: "dialog", name: `Delete ${id}?` }, { timeoutMs: 60_000 });
      const text = await textOf(tab, "dialog", new RegExp(`^Delete ${id}\\?`));
      await ctx.verify("the dialog says the URL stops responding", [
        ctx.holds("the URL line", text.includes(`/i18n/${id}/{locale}.json stops responding`), text.slice(0, 300)),
        ctx.holds("the files line", text.includes("Language files deleted from disk"), text.slice(0, 300)),
      ]);
    },
  },
];

export const roundTwelveScope = [
  {
    id: "scope-bar-shows-the-base-language-on-every-page",
    title: "the workspace bar of the overview, the matrix and the queue reads its base language (Base EN en), counts and public URL",
    entryPoint: "/modules/lang/overview, /translations, /language",
    async run(/** @type {Ctx} */ ctx) {
      const id = freshId(ctx, "bar");
      await seedWorkspace(ctx, id, { locales: ["en", "fr"], keys: { "a.b": { en: "x" } } });
      const tab = await ctx.tab("admin");
      await tab.signIn("admin");
      for (const page of ["overview", "translations", "language?locale=fr&"]) {
        await tab.goto(`/modules/lang/${page}${page.includes("?") ? "" : "?"}workspace=${id}`);
        await tab.visible({ role: "button", name: "Switch workspace" }, { timeoutMs: 60_000 });
        const bar = await scopeBarText(tab);
        await ctx.verify(`${page}: the bar names the base language, the counts and the URL`, [
          ctx.holds("Base EN en", /Base\s*EN\s*en/.test(bar), bar.slice(0, 200)),
          ctx.holds("counts", /Editable/.test(bar) && /2 languages/.test(bar) && /1 key/.test(bar), bar.slice(0, 200)),
        ]);
      }
    },
  },
];

export const roundTwelveMac = [
  {
    id: "command-key-in-the-queue-on-a-mac",
    title: "with a macOS browser Command S saves the queue's text and stays on the key, and Command Enter saves it and moves on",
    entryPoint: "/modules/lang/language?locale=fr",
    async run(/** @type {Ctx} */ ctx) {
      const id = freshId(ctx, "mac");
      await seedWorkspace(ctx, id, { locales: ["en", "fr"], keys: { "auth.logout": { en: "Bye" }, "auth.login": { en: "Hello" } } });
      const tab = await ctx.tab("admin");
      await pretendToBeAMac(tab);
      await tab.signIn("admin");
      await tab.goto(`/modules/lang/language?workspace=${id}&locale=fr&key=auth.logout`);
      await tab.visible({ role: "textbox", name: "Bye" }, { timeoutMs: 60_000 });
      await ctx.verify("the page reads a macOS user agent", [ctx.holds("agent", (await tab.page.evaluate(() => navigator.userAgent)) === MAC_USER_AGENT, "")]);
      await tab.fill({ role: "textbox", name: "Bye" }, "Au revoir");
      await tab.press("Meta+s", { role: "textbox", name: "Bye" });
      const saved = await lang(ctx, "read the key", "GET", `/row?workspace=${id}&key=auth.logout`);
      await ctx.verify("Command S stored the text and the queue stays on the key", [
        ctx.equal("values", pick(saved.body, "row", "values"), { en: "Bye", fr: "Au revoir" }),
        ctx.equal("the field", await fieldValue(tab, { role: "textbox", name: "Bye" }), "Au revoir"),
      ]);
      await tab.fill({ role: "textbox", name: "Bye" }, "Au revoir bis");
      await tab.press("Meta+Enter", { role: "textbox", name: "Bye" });
      await ctx.verify("Command Enter stored the text and moved to auth.login", [
        ctx.equal("values", pick((await lang(ctx, "read the key again", "GET", `/row?workspace=${id}&key=auth.logout`)).body, "row", "values", "fr"), "Au revoir bis"),
        tab.visible({ role: "textbox", name: "Hello" }),
      ]);
    },
  },
  {
    id: "command-enter-in-the-key-panel-on-a-mac",
    title: "with a macOS browser Command Enter in a key panel field saves the texts and opens the next key",
    entryPoint: "/modules/lang/translations?key=a.one",
    async run(/** @type {Ctx} */ ctx) {
      const id = freshId(ctx, "macpanel");
      await seedWorkspace(ctx, id, { locales: ["en", "fr"], keys: { "a.one": { en: "One" }, "a.two": { en: "Two" } } });
      const tab = await ctx.tab("admin");
      await pretendToBeAMac(tab);
      await tab.signIn("admin");
      await tab.goto(`/modules/lang/translations?workspace=${id}&key=a.one`);
      await tab.visible({ role: "textbox", name: "Français" }, { timeoutMs: 60_000 });
      await tab.fill({ role: "textbox", name: "Français" }, "Un");
      await tab.press("Meta+Enter", { role: "textbox", name: "Français" });
      await ctx.verify("the text is stored and the next key is open", [
        ctx.equal("a.one", pick((await lang(ctx, "read a.one", "GET", `/row?workspace=${id}&key=a.one`)).body, "row", "values", "fr"), "Un"),
        tab.visible({ role: "heading", name: "a.two" }),
      ]);
    },
  },
];
