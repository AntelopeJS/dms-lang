import { join } from "node:path";
import { guarded, lang, list, pick, projectLocalesDir, readJsonFile, resetProjectFiles } from "../lang.mjs";

/** @typedef {import("../lang.mjs").Ctx} Ctx */

const KEY = "dms.button.save_changes";

/**
 * @param {Ctx} ctx The journey
 * @param {string} file The project file
 * @returns {unknown} Its messages
 */
function project(ctx, file) {
  return readJsonFile(join(projectLocalesDir(ctx), file));
}

/** The texts the DMS and its modules ship: read-only, and overridden into the project files. */
export const journeys = guarded([
  {
    id: "modules-workspace-is-read-only",
    title: "the Installed modules workspace lists the shipped texts and refuses every write",
    entryPoint: "GET /api/lang/translations/flat?workspace=modules, then writes",
    async run(/** @type {Ctx} */ ctx) {
      resetProjectFiles(ctx);
      const row = await lang(ctx, "read the key of a module", "GET", `/row?workspace=modules&key=${KEY}`);
      await ctx.verify("the shipped texts are listed by language and are not overridden", [
        ctx.equal("values", pick(row.body, "row", "values"), { en: "Save changes", fr: "Enregistrer les modifications" }),
        ctx.equal("overridden", pick(row.body, "row", "overridden"), false),
      ]);
      const put = await lang(ctx, "write a text", "PUT", "/key", { workspace: "modules", path: KEY, values: { fr: "Sauver" } });
      const post = await lang(ctx, "create a key", "POST", "/key", { workspace: "modules", path: "mine.key", values: { en: "x" } });
      const del = await lang(ctx, "delete a key", "DELETE", "/key", { workspace: "modules", path: KEY });
      const locale = await lang(ctx, "add a language", "POST", "/locale", { workspace: "modules", code: "de" });
      await ctx.verify("every write is refused as read-only", [
        ctx.equal("update", [put.status, pick(put.body, "code")], [403, "read_only"]),
        ctx.equal("create", [post.status, pick(post.body, "code")], [403, "read_only"]),
        ctx.equal("delete", [del.status, pick(del.body, "code")], [403, "read_only"]),
        ctx.holds("add a language", locale.status !== null && locale.status >= 400, String(locale.status)),
      ]);
    },
  },
  {
    id: "override-a-module-text",
    title: "writing a module's key in the project files overrides it without touching the module, and dropping the override brings the module's text back",
    entryPoint: "PUT /api/lang/translations/key on the project files, DELETE /key/override",
    async run(/** @type {Ctx} */ ctx) {
      resetProjectFiles(ctx);
      const before = await lang(ctx, "read the figures before", "GET", "/summary");
      /** @type {Record<string, any>[]} */
      const beforeRows = list(before.body, "workspaces");
      const defaults = beforeRows.find((workspace) => workspace.id === "default");
      const written = await lang(ctx, "override the French text", "PUT", "/key", { workspace: "default", path: KEY, values: { fr: "Enregistrer mes changements" } });
      await ctx.verify("the row shows the project's French text over what the module ships", [
        ctx.status(written, 200),
        ctx.equal("values", pick(written.body, "row", "values"), { fr: "Enregistrer mes changements" }),
        ctx.equal("inherited from the module", pick(written.body, "row", "inherited"), { en: "Save changes", fr: "Enregistrer les modifications" }),
        ctx.equal("only the French file got the key", [pick(project(ctx, "app-fr-FR.json"), "dms", "button", "save_changes"), pick(project(ctx, "app-en-GB.json"), "dms")], ["Enregistrer mes changements", undefined]),
      ]);
      const modules = await lang(ctx, "read the key of the module again", "GET", `/row?workspace=modules&key=${KEY}`);
      const after = await lang(ctx, "read the figures after", "GET", "/summary");
      /** @type {Record<string, any>[]} */
      const afterRows = list(after.body, "workspaces");
      const overridden = afterRows.find((workspace) => workspace.id === "default");
      await ctx.verify("the module still ships its own text, the key counts as translated and as an override", [
        ctx.equal("the module's text", pick(modules.body, "row", "values"), { en: "Save changes", fr: "Enregistrer les modifications" }),
        ctx.equal("flagged as overridden in the modules workspace", pick(modules.body, "row", "overridden"), true),
        ctx.equal("overrides", [defaults?.overrides, overridden?.overrides], [0, 1]),
        ctx.equal("the missing translations do not grow", [defaults?.missing, overridden?.missing], [defaults?.missing, defaults?.missing]),
      ]);
      const dropped = await lang(ctx, "drop the override", "DELETE", "/key/override", { workspace: "default", path: KEY });
      const back = await lang(ctx, "read the row", "GET", `/row?workspace=default&key=${KEY}`);
      await ctx.verify("the project no longer defines the key and the module's text applies again", [
        ctx.status(dropped, 200),
        ctx.equal("row", pick(back.body, "row"), undefined),
        ctx.equal("French file", pick(project(ctx, "app-fr-FR.json"), "dms"), undefined),
      ]);
      const locked = await lang(ctx, "delete a module key from the project files", "DELETE", "/key", { workspace: "default", path: KEY });
      await ctx.verify("a key only a module defines cannot be deleted from the project files", [ctx.equal("status", locked.status, 404)]);
    },
  },
]);
