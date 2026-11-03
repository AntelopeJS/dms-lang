import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { freshId, lang, list, pick, projectLocalesDir, readJsonFile, resetProjectFiles, seedWorkspace } from "../../lang.mjs";

/** @typedef {import("../../lang.mjs").Ctx} Ctx */

/**
 * @param {Ctx} ctx The journey
 * @param {string} name The file under the project's locale folder
 * @param {unknown} messages Its messages
 */
function put(ctx, name, messages) {
  const file = join(projectLocalesDir(ctx), name);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(messages, null, 2)}\n`);
}

export const roundTenProject = [
  {
    id: "a-namespace-tie-goes-to-the-last-file",
    title: "when two files hold the same depth of a key's namespace, a new key is written to the last of them in merge order",
    entryPoint: "POST /api/lang/translations/key on the project files",
    async run(/** @type {Ctx} */ ctx) {
      resetProjectFiles(ctx);
      put(ctx, "crm-fr-FR.json", { crm: { deals: { title: "Affaires" } } });
      put(ctx, "zz-fr-FR.json", { crm: { contacts: { title: "Contacts" } } });
      await lang(ctx, "add a key under crm", "POST", "/key", { workspace: "default", path: "crm.notes.title", values: { fr: "Notes" } });
      const first = readJsonFile(join(projectLocalesDir(ctx), "crm-fr-FR.json"));
      const last = readJsonFile(join(projectLocalesDir(ctx), "zz-fr-FR.json"));
      await ctx.verify("the key lands in the last file and the first is untouched", [
        ctx.equal("zz-fr-FR.json", pick(last, "crm", "notes", "title"), "Notes"),
        ctx.equal("crm-fr-FR.json", first, { crm: { deals: { title: "Affaires" } } }),
      ]);
      resetProjectFiles(ctx);
    },
  },
];

export const roundTenNames = [
  {
    id: "language-names-carry-the-region-only-when-shared",
    title: "a language shows its region (Français (Belgique)) only when another language of the workspace shares it, in the matrix, the heatmap and the queue",
    entryPoint: "/modules/lang/translations, /overview, /language",
    async run(/** @type {Ctx} */ ctx) {
      const shared = freshId(ctx, "share");
      const alone = freshId(ctx, "alone");
      await seedWorkspace(ctx, shared, { locales: ["en", "fr", "fr-BE"], keys: { "a.b": { en: "x" } } });
      await seedWorkspace(ctx, alone, { locales: ["en", "fr"], keys: { "a.b": { en: "x" } } });
      const tab = await ctx.tab("admin");
      await tab.signIn("admin");
      await tab.goto(`/modules/lang/translations?workspace=${shared}`);
      await ctx.verify("matrix: both French columns, the regional one named with its region", [
        tab.visible({ role: "gridcell", name: /^Français \d+ missing/ }),
        tab.visible({ role: "gridcell", name: /^Français \(Belgique\) \d+ missing/ }),
      ]);
      await tab.goto(`/modules/lang/overview?workspace=${shared}`);
      await ctx.verify("heatmap: the cell names the region", [tab.visible({ role: "link", name: /^a · Français \(Belgique\): / })]);
      await tab.goto(`/modules/lang/language?workspace=${shared}&locale=fr-BE`);
      await ctx.verify("queue: the title names the region", [tab.shows(/Français \(Belgique\)/)]);
      await tab.goto(`/modules/lang/overview?workspace=${alone}`);
      await ctx.verify("alone, French has no region", [tab.visible({ role: "link", name: /^a · Français: / }), tab.visible({ role: "link", name: /Belgique/ }, { hidden: true })]);
    },
  },
];

export const roundTenQueue = [
  {
    id: "keys-of-a-namespace-come-in-key-order",
    title: "within a namespace the queue walks the missing keys in key order: auth.login, then auth.logout",
    entryPoint: "/modules/lang/language?locale=de",
    async run(/** @type {Ctx} */ ctx) {
      const id = freshId(ctx, "order");
      await seedWorkspace(ctx, id, { locales: ["en", "de"], keys: { "auth.logout": { en: "Bye" }, "auth.login": { en: "Hello" }, "auth.reset": { en: "Reset" } } });
      const tab = await ctx.tab("admin");
      await tab.signIn("admin");
      await tab.goto(`/modules/lang/language?workspace=${id}&locale=de`);
      await ctx.verify("the first key is auth.login", [tab.visible({ role: "textbox", name: "Hello" })]);
      await tab.fill({ role: "textbox", name: "Hello" }, "Hallo");
      await tab.click({ role: "button", name: /Save & next/ });
      await ctx.verify("then auth.logout", [tab.visible({ role: "textbox", name: "Bye" })]);
      await tab.fill({ role: "textbox", name: "Bye" }, "Tschüss");
      await tab.click({ role: "button", name: /Save & next/ });
      await ctx.verify("then auth.reset", [tab.visible({ role: "textbox", name: "Reset" })]);
    },
  },
];

export const roundTenLimits = [
  {
    id: "base-confirm-lists-twenty-keys-and-shows-five",
    title: "making a language the base lists at most 20 of the keys it lacks and shows 5 in the dialog with a count of the rest",
    entryPoint: "GET /api/lang/translations/languages/<workspace>/<code>/base-confirm",
    async run(/** @type {Ctx} */ ctx) {
      const id = freshId(ctx, "lim");
      /** @type {Record<string, Record<string, string>>} */
      const keys = {};
      for (let n = 0; n < 25; n += 1) keys[`a.k${String(n).padStart(2, "0")}`] = { en: `T${n}` };
      await seedWorkspace(ctx, id, { locales: ["en", "fr"], keys });
      const answer = await lang(ctx, "ask about French", "GET", `/languages/${id}/fr/base-confirm`);
      const impact = list(answer.body, "impact");
      await ctx.verify("25 missing, 20 keys named, 5 shown and a line for the other 20", [
        ctx.equal("missing", pick(answer.body, "missing"), 25),
        ctx.equal("listed keys", JSON.stringify(pick(answer.body, "keys")).split(",").length, 20),
        ctx.equal("shown", impact.length, 6),
        ctx.equal("the rest", impact.at(-1)?.count, 20),
      ]);
    },
  },
  {
    id: "description-is-at-most-500-characters",
    title: "a workspace description of 500 characters is accepted and one of 501 is refused",
    entryPoint: "PATCH /api/lang/translations/workspace",
    async run(/** @type {Ctx} */ ctx) {
      const id = freshId(ctx, "desc");
      await seedWorkspace(ctx, id, { locales: ["en"] });
      const ok = await lang(ctx, "describe with 500", "PATCH", "/workspace", { id, description: "d".repeat(500) });
      const bad = await lang(ctx, "describe with 501", "PATCH", "/workspace", { id, description: "d".repeat(501) });
      await ctx.verify("500 accepted, 501 refused", [ctx.status(ok, 200), ctx.equal("501", bad.status, 400)]);
    },
  },
  {
    id: "up-next-lists-four-keys",
    title: "the queue's Up next lists the next four keys",
    entryPoint: "/modules/lang/language?locale=fr",
    async run(/** @type {Ctx} */ ctx) {
      const id = freshId(ctx, "upnext");
      /** @type {Record<string, Record<string, string>>} */
      const keys = {};
      for (let n = 0; n < 8; n += 1) keys[`a.k${n}`] = { en: `Text${n}` };
      await seedWorkspace(ctx, id, { locales: ["en", "fr"], keys });
      const tab = await ctx.tab("admin");
      await tab.signIn("admin");
      await tab.goto(`/modules/lang/language?workspace=${id}&locale=fr`);
      await ctx.verify("a.k1 to a.k4 are listed, a.k5 is not", [
        tab.visible({ role: "button", name: "a.k1" }),
        tab.visible({ role: "button", name: "a.k4" }),
        tab.visible({ role: "button", name: "a.k5" }, { hidden: true }),
      ]);
    },
  },
];
