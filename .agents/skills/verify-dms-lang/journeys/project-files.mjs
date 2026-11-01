import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { guarded, lang, list, pick, projectLocalesDir, readJsonFile, resetProjectFiles } from "../lang.mjs";
import { projectFileJourneys } from "./parts/frontend-modules.mjs";

/** @typedef {import("../lang.mjs").Ctx} Ctx */

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

/**
 * @param {Ctx} ctx The journey
 * @param {string} name The file under the project's locale folder
 * @param {...string} path A field inside the file
 * @returns {unknown} The field, or the whole file when no field is named
 */
function read(ctx, name, ...path) {
  return pick(readJsonFile(join(projectLocalesDir(ctx), name)), ...path);
}

/**
 * @param {Ctx} ctx The journey
 * @param {string} label What the read does
 * @returns {Promise<Map<string, unknown>>} The rows of the project files by key
 */
async function rowsOf(ctx, label) {
  const flat = await lang(ctx, label, "GET", "/flat?workspace=default");
  return new Map(list(flat.body, "rows").map((row) => [String(row.key), pick(row, "values")]));
}

/** The project files: the locale files of the application layer, merged and written back where the key lives. */
export const journeys = guarded([
  {
    id: "discovery-by-file-name",
    title: "every <name>-<xx-XX>.json under the locale folder is a project file, other names are ignored, and a file change shows on the next read",
    entryPoint: "frontend-vue/i18n/locales/*-xx-XX.json of the flagged frontend module",
    async run(/** @type {Ctx} */ ctx) {
      resetProjectFiles(ctx);
      put(ctx, "crm-en-GB.json", { crm: { deals: { title: "Deals" } } });
      put(ctx, "crm-fr-FR.json", { crm: { deals: { title: "Affaires" } } });
      put(ctx, "team-en-US.json", { team: { name: "Team" } });
      put(ctx, "nested/misc-en-GB.json", { misc: { note: "Nested" } });
      put(ctx, "app-it.json", { ignored: { regionless: "no" } });
      put(ctx, "en.json", { ignored: { bare: "no" } });
      put(ctx, "app-de-DE.txt", { ignored: { extension: "no" } });
      const flat = await lang(ctx, "read the project files", "GET", "/flat?workspace=default");
      const rows = await rowsOf(ctx, "read the rows");
      await ctx.verify("files named <name>-<xx-XX>.json count, in subfolders too, and regions merge into their language", [
        ctx.equal("languages", pick(flat.body, "locales"), ["en", "fr"]),
        ctx.equal("crm.deals.title", rows.get("crm.deals.title"), { en: "Deals", fr: "Affaires" }),
        ctx.equal("en-US contributes to en", rows.get("team.name"), { en: "Team" }),
        ctx.equal("a subfolder is scanned", rows.get("misc.note"), { en: "Nested" }),
        ctx.equal("the playground's own keys stay", rows.get("shop.title"), { en: "Shop", fr: "Boutique" }),
        ctx.equal("ignored files add no key", [...rows.keys()].filter((key) => key.startsWith("ignored.")), []),
      ]);
      rmSync(join(projectLocalesDir(ctx), "team-en-US.json"));
      put(ctx, "crm-en-GB.json", { crm: { deals: { title: "Deals (edited)" } } });
      const after = await rowsOf(ctx, "read the rows after the file changes");
      await ctx.verify("a removed file and an edited file show on the next read", [
        ctx.equal("team.name is gone", after.get("team.name"), undefined),
        ctx.equal("the edit", after.get("crm.deals.title"), { en: "Deals (edited)", fr: "Affaires" }),
      ]);
      resetProjectFiles(ctx);
    },
  },
  {
    id: "layers-replace-the-root-folder",
    title: "when a layers folder exists, only layers/*/i18n/locales is scanned, even if it is empty",
    entryPoint: "frontend-vue/layers/*/i18n/locales",
    async run(/** @type {Ctx} */ ctx) {
      resetProjectFiles(ctx);
      const layers = join(projectLocalesDir(ctx), "..", "..", "layers");
      mkdirSync(layers, { recursive: true });
      await ctx.restartBackend();
      const empty = await rowsOf(ctx, "read the rows with an empty layers folder");
      await ctx.verify("an empty layers folder hides the root locale folder", [ctx.equal("rows", [...empty.keys()], [])]);
      mkdirSync(join(layers, "shop", "i18n", "locales", "deep"), { recursive: true });
      writeFileSync(join(layers, "shop", "i18n", "locales", "deep", "shop-en-GB.json"), `${JSON.stringify({ layered: { key: "From a layer" } }, null, 2)}\n`);
      await ctx.restartBackend();
      const layered = await rowsOf(ctx, "read the rows with a layer");
      await ctx.verify("the layer's files, subfolders included, are the project files", [
        ctx.equal("rows", [...layered.entries()], [["layered.key", { en: "From a layer" }]]),
      ]);
      rmSync(layers, { recursive: true, force: true });
      await ctx.restartBackend();
      const back = await rowsOf(ctx, "read the rows without layers");
      await ctx.verify("without a layers folder the root locale folder is scanned again", [ctx.equal("a root key", back.get("shop.title"), { en: "Shop", fr: "Boutique" })]);
    },
  },
  {
    id: "later-file-wins",
    title: "files merge per language in file-name order and a later file wins on a key both define",
    entryPoint: "frontend-vue/i18n/locales/a-en-GB.json and b-en-GB.json",
    async run(/** @type {Ctx} */ ctx) {
      resetProjectFiles(ctx);
      put(ctx, "a-en-GB.json", { x: { y: "from a", only_a: "A" } });
      put(ctx, "b-en-GB.json", { x: { y: "from b", only_b: "B" } });
      const rows = await rowsOf(ctx, "read the merged rows");
      await ctx.verify("one row per key and the later file's text", [
        ctx.equal("x.y", rows.get("x.y"), { en: "from b" }),
        ctx.equal("x.only_a", rows.get("x.only_a"), { en: "A" }),
        ctx.equal("x.only_b", rows.get("x.only_b"), { en: "B" }),
      ]);
      resetProjectFiles(ctx);
    },
  },
  {
    id: "writes-follow-the-defining-file",
    title: "a write goes to the file that defines the key, a new key to the file with the longest part of its namespace, else to app-<xx-XX>.json, else to the last file",
    entryPoint: "PUT /api/lang/translations/key on the project files",
    async run(/** @type {Ctx} */ ctx) {
      resetProjectFiles(ctx);
      rmSync(join(projectLocalesDir(ctx), "app-en-GB.json"));
      rmSync(join(projectLocalesDir(ctx), "app-fr-FR.json"));
      put(ctx, "app-en-GB.json", { shop: { title: "Shop" } });
      put(ctx, "app-fr-FR.json", { shop: { title: "Boutique" } });
      put(ctx, "app-zeta-fr-FR.json", { zeta: { word: "Zeta" } });
      put(ctx, "crm-en-GB.json", { crm: { deals: { title: "Deals" }, contacts: { title: "Contacts" } } });
      put(ctx, "crm-fr-FR.json", { crm: { deals: { title: "Affaires" } } });
      put(ctx, "team-fr-FR.json", { team: { name: "Equipe" } });
      const write = (/** @type {string} */ label, /** @type {string} */ path, /** @type {Record<string, string>} */ values, /** @type {boolean} */ create) =>
        lang(ctx, label, create ? "POST" : "PUT", "/key", { workspace: "default", path, values });
      await write("edit an existing key", "crm.deals.title", { fr: "Offres" }, false);
      await ctx.verify("1. an existing key is written to the file that defines it", [
        ctx.equal("crm-fr-FR.json", read(ctx, "crm-fr-FR.json", "crm", "deals", "title"), "Offres"),
        ctx.equal("app-fr-FR.json untouched", read(ctx, "app-fr-FR.json"), { shop: { title: "Boutique" } }),
      ]);
      await write("add a key under crm.deals", "crm.deals.subtitle", { en: "Open deals", fr: "Offres ouvertes" }, true);
      await ctx.verify("2. a new key goes to the file that already has the longest part of its namespace", [
        ctx.equal("French in crm-fr-FR.json", read(ctx, "crm-fr-FR.json", "crm", "deals", "subtitle"), "Offres ouvertes"),
        ctx.equal("English in crm-en-GB.json", read(ctx, "crm-en-GB.json", "crm", "deals", "subtitle"), "Open deals"),
      ]);
      await write("add a key under crm.contacts", "crm.contacts.phone", { fr: "Téléphone" }, true);
      await ctx.verify("2b. a shorter shared part still routes to that file", [
        ctx.equal("crm-fr-FR.json", read(ctx, "crm-fr-FR.json", "crm", "contacts"), { phone: "Téléphone" }),
      ]);
      await write("add a key with no shared namespace", "billing.total", { en: "Total", fr: "Somme" }, true);
      await ctx.verify("3. with no shared namespace it goes to the last file named exactly app-<xx-XX>.json, not to a domain file", [
        ctx.equal("app-fr-FR.json", read(ctx, "app-fr-FR.json", "billing"), { total: "Somme" }),
        ctx.equal("app-zeta-fr-FR.json untouched", read(ctx, "app-zeta-fr-FR.json"), { zeta: { word: "Zeta" } }),
        ctx.equal("app-en-GB.json", read(ctx, "app-en-GB.json", "billing"), { total: "Total" }),
      ]);
      rmSync(join(projectLocalesDir(ctx), "app-fr-FR.json"));
      await write("add a key with no app file left", "invoices.number", { en: "Number", fr: "Numéro" }, true);
      await ctx.verify("4. without an exact app file it goes to the last file of the language in merge order", [
        ctx.equal("team-fr-FR.json", read(ctx, "team-fr-FR.json", "invoices"), { number: "Numéro" }),
      ]);
      resetProjectFiles(ctx);
    },
  },
  {
    id: "delete-uncovers-the-older-definition",
    title: "deleting, clearing or renaming a key changes only its winning definition, so an older duplicate shows again",
    entryPoint: "DELETE /api/lang/translations/key on the project files",
    async run(/** @type {Ctx} */ ctx) {
      resetProjectFiles(ctx);
      put(ctx, "a-en-GB.json", { dup: { one: "older one", two: "older two", three: "older three" } });
      put(ctx, "b-en-GB.json", { dup: { one: "newer one", two: "newer two", three: "newer three" } });
      put(ctx, "b-fr-FR.json", { dup: { two: "deux" } });
      const deleted = await lang(ctx, "delete dup.one", "DELETE", "/key", { workspace: "default", path: "dup.one" });
      await ctx.verify("only the winning definition is removed and the older text shows again", [
        ctx.status(deleted, 200),
        ctx.equal("b-en-GB.json", read(ctx, "b-en-GB.json", "dup"), { two: "newer two", three: "newer three" }),
        ctx.equal("a-en-GB.json keeps its text", read(ctx, "a-en-GB.json", "dup", "one"), "older one"),
        ctx.equal("the row now reads the older text", pick(deleted.body, "row", "values"), { en: "older one" }),
      ]);
      const cleared = await lang(ctx, "clear the English text of dup.two", "PUT", "/key", { workspace: "default", path: "dup.two", values: { en: "" } });
      await ctx.verify("clearing a text removes only the winning definition too", [
        ctx.status(cleared, 200),
        ctx.equal("b-en-GB.json", read(ctx, "b-en-GB.json", "dup"), { three: "newer three" }),
        ctx.equal("the row", pick(cleared.body, "row", "values"), { en: "older two", fr: "deux" }),
      ]);
      const renamed = await lang(ctx, "rename dup.three", "POST", "/key/rename", { workspace: "default", path: "dup.three", newPath: "dup.moved" });
      await ctx.verify("a rename moves the winning definition in its own file and the older one keeps the source key", [
        ctx.status(renamed, 200),
        ctx.equal("b-en-GB.json", read(ctx, "b-en-GB.json", "dup"), { moved: "newer three" }),
        ctx.equal("a-en-GB.json still defines dup.three", read(ctx, "a-en-GB.json", "dup", "three"), "older three"),
      ]);
      resetProjectFiles(ctx);
    },
  },
  {
    id: "rename-stays-in-the-defining-file",
    title: "a renamed key stays in the file that defined it, whatever the namespace of the new name",
    entryPoint: "POST /api/lang/translations/key/rename on the project files",
    async run(/** @type {Ctx} */ ctx) {
      resetProjectFiles(ctx);
      put(ctx, "app-en-GB.json", { shop: { title: "Shop" } });
      put(ctx, "crm-en-GB.json", { crm: { deals: { title: "Deals" } } });
      const renamed = await lang(ctx, "rename a crm key into the shop namespace", "POST", "/key/rename", { workspace: "default", path: "crm.deals.title", newPath: "shop.deals" });
      await ctx.verify("the new name is written in crm-en-GB.json, not in app-en-GB.json", [
        ctx.status(renamed, 200),
        ctx.equal("crm file", read(ctx, "crm-en-GB.json"), { shop: { deals: "Deals" } }),
        ctx.equal("app file", read(ctx, "app-en-GB.json"), { shop: { title: "Shop" } }),
      ]);
      resetProjectFiles(ctx);
    },
  },
  {
    id: "dropping-an-override-removes-only-the-winning-one",
    title: "dropping an override removes the winning definition of the module's key and an older project definition shows again",
    entryPoint: "DELETE /api/lang/translations/key/override",
    async run(/** @type {Ctx} */ ctx) {
      resetProjectFiles(ctx);
      put(ctx, "a-fr-FR.json", { dms: { button: { save_changes: "Older override" } } });
      put(ctx, "b-fr-FR.json", { dms: { button: { save_changes: "Newer override" } } });
      const dropped = await lang(ctx, "drop the override", "DELETE", "/key/override", { workspace: "default", path: "dms.button.save_changes" });
      const row = await lang(ctx, "read the key", "GET", "/row?workspace=default&key=dms.button.save_changes");
      await ctx.verify("only the newer definition is gone", [
        ctx.status(dropped, 200),
        ctx.equal("b file", read(ctx, "b-fr-FR.json", "dms"), undefined),
        ctx.equal("a file", read(ctx, "a-fr-FR.json", "dms", "button", "save_changes"), "Older override"),
        ctx.equal("the row", pick(row.body, "row", "values", "fr"), "Older override"),
      ]);
      resetProjectFiles(ctx);
    },
  },
  {
    id: "no-workspace-query-defaults-to-the-project-files",
    title: "a page opened without ?workspace= by someone who never chose one lands on the project files",
    entryPoint: "/modules/lang/overview",
    async run(/** @type {Ctx} */ ctx) {
      const tab = await ctx.tab("admin");
      await tab.signIn("admin");
      await tab.goto("/modules/lang/overview");
      await ctx.verify("the scope bar names the project files", [tab.shows(/workspace\s*project files/i)]);
    },
  },
  ...projectFileJourneys,
]);
