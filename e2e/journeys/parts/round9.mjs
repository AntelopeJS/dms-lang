import { currentUrl, drawnRows, footerGap, heatTone, scrollRows } from "../../files.mjs";
import { clickUntil, fieldValue, freshId, lang, list, pick, raw, recordRaw, seedWorkspace, workspacesDir } from "../../lang.mjs";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** @typedef {import("../../lang.mjs").Ctx} Ctx */

/**
 * @param {Ctx} ctx The journey
 * @param {string} id The workspace
 * @param {Record<string, Record<string, string>>} en English texts by namespace then key
 * @param {Record<string, Record<string, string>>} fr French texts by namespace then key
 */
async function importTrees(ctx, id, en, fr) {
  await lang(ctx, "import the trees", "POST", "/import", { format: "dms-lang.workspace", version: 1, id, defaultLocale: "en", locales: [{ code: "en" }, { code: "fr" }], messages: { en, fr } });
}

/** Rules a doc sweep found asserted nowhere: batches, tones, base issues, empty removals, layout, segments, closers. */
export const roundNineMatrix = [
  {
    id: "rows-are-drawn-in-batches-of-100",
    title: "one namespace of 250 keys draws 100 rows, then 200, then 250 as the end of the list scrolls into view",
    entryPoint: "/modules/lang/translations",
    async run(/** @type {Ctx} */ ctx) {
      const id = freshId(ctx, "batch");
      /** @type {Record<string, string>} */
      const ns = {};
      for (let n = 0; n < 250; n += 1) ns[`k${String(n).padStart(3, "0")}`] = `Text ${n}`;
      await importTrees(ctx, id, { all: ns }, { all: {} });
      const tab = await ctx.tab("admin");
      await tab.signIn("admin");
      await tab.goto(`/modules/lang/translations?workspace=${id}`);
      await tab.visible({ role: "button", name: "Open all.k000 in the panel" });
      const first = await drawnRows(tab);
      const second = await scrollRows(tab);
      const third = await scrollRows(tab);
      await ctx.verify("100, then 200, then 250 rows", [ctx.holds("first batch is 100 rows (the group header takes a slot)", first >= 95 && first <= 100, String(first)), ctx.holds("second batch is 200", second >= 195 && second <= 200, String(second)), ctx.equal("third batch", third, 250)]);
    },
  },
  {
    id: "issues-tab-holds-a-base-text-that-does-not-compile",
    title: "a key whose base text does not compile is an issue of the base language and is listed under Issues; a valid base is not",
    entryPoint: "/modules/lang/translations?filter=issues",
    async run(/** @type {Ctx} */ ctx) {
      const id = freshId(ctx, "badbase");
      await importTrees(ctx, id, { a: { broken: "Pay {price", fine: "Fine" } }, { a: { broken: "Payer", fine: "Bien" } }).catch(() => undefined);
      const made = await lang(ctx, "read the keys", "GET", `/flat?workspace=${id}`);
      if (made.status !== 200) {
        await seedWorkspace(ctx, id, { locales: ["en", "fr"], keys: { "a.fine": { en: "Fine", fr: "Bien" } } });
        writeFileSync(join(workspacesDir(ctx, id), "en.json"), `${JSON.stringify({ a: { broken: "Pay {price", fine: "Fine" } }, null, "\t")}\n`);
      }
      const flat = await lang(ctx, "read the keys again", "GET", `/flat?workspace=${id}`);
      const broken = list(flat.body, "rows").find((row) => row.key === "a.broken");
      const tab = await ctx.tab("admin");
      await tab.signIn("admin");
      await tab.goto(`/modules/lang/translations?workspace=${id}&filter=issues`);
      await ctx.verify("the broken base text is an issue of en and listed", [
        ctx.equal("issues", broken?.issues, ["en"]),
        tab.visible({ role: "button", name: "Open a.broken in the panel" }),
        tab.visible({ role: "button", name: "Open a.fine in the panel" }, { hidden: true }),
      ]);
    },
  },
  {
    id: "overridden-badge-opens-the-override",
    title: "in the installed modules a click on the Overridden badge opens the override in the project files",
    entryPoint: "/modules/lang/translations?workspace=modules",
    async run(/** @type {Ctx} */ ctx) {
      await lang(ctx, "override a module text", "PUT", "/key", { workspace: "default", path: "dms.button.save_changes", values: { fr: "Enregistrer mes changements" } });
      const tab = await ctx.tab("admin");
      await tab.signIn("admin");
      await tab.goto("/modules/lang/translations?workspace=modules&q=dms.button.save_changes");
      await tab.visible({ role: "button", name: "Overridden" });
      await tab.click({ role: "button", name: "Overridden" });
      await tab.visible({ role: "heading", name: "dms.button.save_changes" });
      await ctx.verify("the project files open on the key", [
        ctx.holds("workspace and key in the URL", /workspace=default/.test(currentUrl(tab)) && /key=dms\.button\.save_changes/.test(currentUrl(tab)), currentUrl(tab)),
        tab.shows(/Enregistrer mes changements/),
      ]);
      await lang(ctx, "drop the override", "DELETE", "/key/override", { workspace: "default", path: "dms.button.save_changes", locales: ["fr"] });
    },
  },
  {
    id: "the-tabs-are-named-incomplete-and-missing",
    title: "the status tab reads Incomplete over several languages and Missing when one language is counted",
    entryPoint: "/modules/lang/translations",
    async run(/** @type {Ctx} */ ctx) {
      const id = freshId(ctx, "tabs");
      await seedWorkspace(ctx, id, { locales: ["en", "fr", "de"], keys: { "a.one": { en: "One" } } });
      const tab = await ctx.tab("admin");
      await tab.signIn("admin");
      await tab.goto(`/modules/lang/translations?workspace=${id}`);
      await ctx.verify("every language: Incomplete", [tab.visible({ role: "radio", name: "Incomplete 1" })]);
      await tab.goto(`/modules/lang/translations?workspace=${id}&missingIn=fr&filter=missing`);
      await ctx.verify("one language: Missing", [tab.visible({ role: "radio", name: "Missing 1" })]);
    },
  },
  {
    id: "key-panel-closers-save-the-changed-language",
    title: "closing the key panel with its X, with Escape or with a click outside saves the changed language first",
    entryPoint: "/modules/lang/translations?key=",
    async run(/** @type {Ctx} */ ctx) {
      const id = freshId(ctx, "closers");
      await seedWorkspace(ctx, id, { locales: ["en", "fr"], keys: { "a.x": { en: "X" }, "a.y": { en: "Y" }, "a.z": { en: "Z" } } });
      const tab = await ctx.tab("admin");
      await tab.signIn("admin");
      /** @type {[string, string][]} */
      const closers = [["a.x", "X"], ["a.y", "Escape"], ["a.z", "outside"]];
      for (const [key, way] of closers) {
        await tab.goto(`/modules/lang/translations?workspace=${id}&key=${key}`);
        await clickUntil(tab, { role: "textbox", name: "Français" }, { role: "heading", name: key });
        await tab.fill({ role: "textbox", name: "Français" }, `fr ${key}`);
        if (way === "X") await tab.click({ role: "button", name: "Close" });
        else if (way === "Escape") {
          await tab.press("Escape");
          await tab.press("Escape");
        } else await tab.page.mouse.click(5, 300);
        const row = await eventuallyValue(ctx, id, key);
        await ctx.verify(`closing by ${way} saved the text`, [ctx.equal("fr", row, `fr ${key}`)]);
      }
    },
  },
];

/**
 * @param {Ctx} ctx The journey
 * @param {string} id The workspace
 * @param {string} key The key
 * @returns {Promise<unknown>} The French text once stored, or what is there after a few reads
 */
async function eventuallyValue(ctx, id, key) {
  let value;
  for (let attempt = 0; attempt < 8 && value === undefined; attempt += 1) {
    value = pick((await lang(ctx, `read ${key}`, "GET", `/row?workspace=${id}&key=${key}`)).body, "row", "values", "fr");
    if (value === undefined) await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return value;
}

export const roundNineOverview = [
  {
    id: "heatmap-tones-switch-at-90-and-60",
    title: "a heatmap cell is green from 90%, amber from 60 to 89% and red below 60%",
    entryPoint: "/modules/lang/overview",
    async run(/** @type {Ctx} */ ctx) {
      const id = freshId(ctx, "tone");
      /** @type {Record<string, Record<string, string>>} */
      const en = {};
      /** @type {Record<string, Record<string, string>>} */
      const fr = {};
      /** @type {[string, number][]} */
      const shares = [["n90", 9], ["n80", 8], ["n60", 6], ["n50", 5]];
      for (const [ns, translated] of shares) {
        en[ns] = {};
        fr[ns] = {};
        for (let n = 0; n < 10; n += 1) {
          en[ns][`k${n}`] = `T${n}`;
          if (n < translated) fr[ns][`k${n}`] = `F${n}`;
        }
      }
      en.n89 = {};
      fr.n89 = {};
      for (let n = 0; n < 100; n += 1) {
        en.n89[`k${n}`] = `T${n}`;
        if (n < 89) fr.n89[`k${n}`] = `F${n}`;
      }
      await importTrees(ctx, id, en, fr);
      const tab = await ctx.tab("admin");
      await tab.signIn("admin");
      await tab.goto(`/modules/lang/overview?workspace=${id}`);
      await tab.visible({ role: "link", name: /^n90 · Français/ });
      await ctx.verify("90 is green, 89 and 80 and 60 amber, 50 red", [
        ctx.equal("90", await heatTone(tab, /^n90 · Français/), "success"),
        ctx.equal("89", await heatTone(tab, /^n89 · Français/), "warning"),
        ctx.equal("80", await heatTone(tab, /^n80 · Français/), "warning"),
        ctx.equal("60", await heatTone(tab, /^n60 · Français/), "warning"),
        ctx.equal("50", await heatTone(tab, /^n50 · Français/), "error"),
      ]);
    },
  },
];

export const roundNineLanguages = [
  {
    id: "removing-an-empty-language-asks-for-no-code",
    title: "removing a language that holds no text asks no code and offers no download; with a text it asks for the code and offers the file",
    entryPoint: "GET /api/lang/translations/languages/<workspace>/<code>/removal-confirm",
    async run(/** @type {Ctx} */ ctx) {
      const id = freshId(ctx, "emptyl");
      await seedWorkspace(ctx, id, { locales: ["en", "fr", "de"], keys: { "a.b": { en: "Hello", fr: "Salut" } } });
      const empty = await lang(ctx, "ask about German", "GET", `/languages/${id}/de/removal-confirm`);
      const full = await lang(ctx, "ask about French", "GET", `/languages/${id}/fr/removal-confirm`);
      await ctx.verify("German has no text: nothing to type or download", [ctx.equal("confirmText", pick(empty.body, "confirmText"), undefined), ctx.equal("secondaryAction", pick(empty.body, "secondaryAction") === undefined, true)]);
      await ctx.verify("French has one: the code is asked and the file offered", [ctx.equal("confirmText", pick(full.body, "confirmText"), "fr"), ctx.equal("secondaryAction", pick(full.body, "secondaryAction") !== undefined, true)]);
    },
  },
];

export const roundNineKeys = [
  {
    id: "key-segments-are-at-most-128-characters",
    title: "a key path segment of 128 characters is accepted and one of 129 is refused as invalid_key_path",
    entryPoint: "POST /api/lang/translations/key",
    async run(/** @type {Ctx} */ ctx) {
      const id = freshId(ctx, "seg");
      await seedWorkspace(ctx, id, { locales: ["en"] });
      const ok = await lang(ctx, "add a 128 character segment", "POST", "/key", { workspace: id, path: `a.${"s".repeat(128)}`, values: { en: "x" } });
      const bad = await lang(ctx, "add a 129 character segment", "POST", "/key", { workspace: id, path: `a.${"s".repeat(129)}`, values: { en: "x" } });
      await ctx.verify("128 accepted, 129 refused", [ctx.status(ok, 200), ctx.equal("129", [bad.status, pick(bad.body, "code")], [400, "invalid_key_path"])]);
    },
  },
  {
    id: "files-are-written-back-in-their-own-layout",
    title: "a language file with two-space indentation, CRLF lines and no final newline keeps that layout when a key is written",
    entryPoint: "PUT /api/lang/translations/key on a hand-written folder",
    async run(/** @type {Ctx} */ ctx) {
      const id = freshId(ctx, "layout");
      await seedWorkspace(ctx, id, { locales: ["en", "fr"], keys: { "a.one": { en: "One", fr: "Un" } } });
      const file = join(workspacesDir(ctx, id), "fr.json");
      mkdirSync(workspacesDir(ctx, id), { recursive: true });
      writeFileSync(file, '{\r\n  "a": {\r\n    "one": "Un"\r\n  }\r\n}');
      await lang(ctx, "add a text", "POST", "/key", { workspace: id, path: "a.two", values: { en: "Two", fr: "Deux" } });
      const text = readFileSync(file, "utf8");
      await ctx.verify("same indent, CRLF, no final newline", [
        ctx.holds("two-space indent", text.includes('\r\n  "a": {'), JSON.stringify(text)),
        ctx.holds("only CRLF", !/[^\r]\n/.test(text), JSON.stringify(text)),
        ctx.holds("no final newline", !text.endsWith("\n"), JSON.stringify(text.slice(-8))),
        ctx.holds("the new text is there", text.includes('"two": "Deux"'), JSON.stringify(text)),
      ]);
    },
  },
];

export const roundNineQueue = [
  {
    id: "s-and-p-typed-in-the-field-are-text",
    title: "typing s and p in the text field writes the letters and does not skip or go back",
    entryPoint: "/modules/lang/language?locale=fr",
    async run(/** @type {Ctx} */ ctx) {
      const id = freshId(ctx, "typing");
      await seedWorkspace(ctx, id, { locales: ["en", "fr"], keys: { "a.one": { en: "Bye" }, "a.two": { en: "Hi" } } });
      const tab = await ctx.tab("admin");
      await tab.signIn("admin");
      await tab.goto(`/modules/lang/language?workspace=${id}&locale=fr`);
      await tab.fill({ role: "textbox", name: "Bye" }, "");
      await tab.page.getByRole("textbox", { name: "Bye" }).pressSequentially("sp");
      await ctx.verify("the letters are in the field of the same key", [ctx.equal("field", await fieldValue(tab, { role: "textbox", name: "Bye" }), "sp"), tab.visible({ role: "textbox", name: "Hi" }, { hidden: true })]);
    },
  },
];

export const roundNinePublic = [
  {
    id: "a-region-without-a-file-is-served-its-language",
    title: "fr-BE.json is served the fr file with Content-Language fr when the workspace has no fr-BE",
    entryPoint: "GET /i18n/<workspace>/fr-BE.json",
    async run(/** @type {Ctx} */ ctx) {
      const id = freshId(ctx, "region");
      await seedWorkspace(ctx, id, { locales: ["en", "fr"], keys: { "a.b": { en: "x", fr: "y" } } });
      const served = await raw(ctx, "read fr-BE", { path: `/i18n/${id}/fr-BE.json` });
      recordRaw(ctx, served, [ctx.equal("status", served.status, 200), ctx.equal("body", served.json, { a: { b: "y" } }), ctx.equal("Content-Language", served.headers["content-language"], "fr")]);
    },
  },
];

export const roundNinePanel = [
  {
    id: "key-panel-footer-stays-on-the-bottom-edge",
    title: "the footer of the key panel sits on the drawer's bottom edge whether the key has two languages or six",
    entryPoint: "/modules/lang/translations?key=",
    async run(/** @type {Ctx} */ ctx) {
      const few = freshId(ctx, "foot");
      const many = freshId(ctx, "feet");
      await seedWorkspace(ctx, few, { locales: ["en", "fr"], keys: { "a.b": { en: "x" } } });
      await seedWorkspace(ctx, many, { locales: ["en", "fr", "de", "es", "it", "pt"], keys: { "a.b": { en: "x" } } });
      const tab = await ctx.tab("admin");
      await tab.signIn("admin");
      const gaps = [];
      for (const id of [few, many]) {
        await tab.goto(`/modules/lang/translations?workspace=${id}&key=a.b`);
        await tab.visible({ role: "heading", name: "a.b" });
        await tab.page.waitForTimeout(1500);
        gaps.push(await footerGap(tab, "a.b", "Save"));
      }
      await ctx.verify("the Save button is within 40 px of the drawer's bottom in both", [ctx.holds("gaps", gaps.every((gap) => gap >= 0 && gap <= 40), gaps.join(", "))]);
    },
  },
];
