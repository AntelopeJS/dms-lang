import { join } from "node:path";
import { freshId, guarded, lang, list, pick, projectLocalesDir, raw, readJsonFile, recordRaw, resetProjectFiles, seedWorkspace, toRow, workspaceFiles } from "../lang.mjs";

/** @typedef {import("../lang.mjs").Ctx} Ctx */

const OVERRIDDEN_KEY = "dms.button.save_changes";

/**
 * @param {Ctx} ctx The journey
 * @returns {unknown} The French text the project files define for the module key, if any
 */
function projectOverride(ctx) {
  return pick(readJsonFile(join(projectLocalesDir(ctx), "app-fr-FR.json")), "dms", "button", "save_changes");
}

/** Who may read and write the translations: the platform owner, only where `editable` is on. */
export const journeys = guarded([
  {
    id: "anonymous-callers-are-refused",
    title: "the API answers 401 to a visitor, while the public files stay open",
    entryPoint: "GET and POST /api/lang/translations/* without a session",
    async run(/** @type {Ctx} */ ctx) {
      const id = freshId(ctx, "shop");
      await seedWorkspace(ctx, id, { locales: ["en"], keys: { "a.b": { en: "Hello" } } });
      const calls = /** @type {[string, string, string, unknown][]} */ ([
        ["list the workspaces", "GET", "/workspaces", undefined],
        ["read the keys", "GET", `/flat?workspace=${id}`, undefined],
        ["download a backup", "GET", `/backup?workspace=${id}`, undefined],
        ["create a workspace", "POST", "/workspace", { id: freshId(ctx, "x"), locale: { code: "en" } }],
        ["write a text", "PUT", "/key", { workspace: id, path: "a.b", values: { en: "Hacked" } }],
        ["delete the workspace", "DELETE", "/workspace", { id }],
      ]);
      for (const [label, method, path, body] of calls) {
        const answer = await ctx.api(label, { method, path: `/api/lang/translations${path}`, body, as: "anon" });
        await ctx.verify(`as a visitor: ${label}`, [ctx.status(answer, 401)]);
      }
      const owner = await lang(ctx, "read the keys as the owner", "GET", `/flat?workspace=${id}`);
      const publicRead = await raw(ctx, "read the public file as a visitor", { path: `/i18n/${id}/en.json` });
      recordRaw(ctx, publicRead, [ctx.equal("status", publicRead.status, 200), ctx.equal("body", publicRead.json, { a: { b: "Hello" } })]);
      await ctx.verify("nothing a visitor sent changed the workspace", [
        ctx.status(owner, 200),
        ctx.equal("rows", pick(owner.body, "rows"), [{ key: "a.b", values: { en: "Hello" } }]),
        ctx.equal("files", workspaceFiles(ctx, id), [".workspace.json", "en.json"]),
      ]);
    },
  },
  {
    id: "read-only-without-editable",
    title: "with editable off every write answers read-only, the reads and the public files keep working",
    entryPoint: "the module option editable: false",
    async run(/** @type {Ctx} */ ctx) {
      const id = freshId(ctx, "shop");
      await seedWorkspace(ctx, id, { locales: ["en", "fr"], keys: { "a.b": { en: "Hello", fr: "Bonjour" }, "a.e": { en: "Only English" } } });
      resetProjectFiles(ctx);
      const overridden = await lang(ctx, "override a module text in the project files", "PUT", "/key", { workspace: "default", path: OVERRIDDEN_KEY, values: { fr: "Enregistrer mes changements" } });
      await ctx.verify("the project files hold an override to drop", [ctx.status(overridden, 200), ctx.equal("French file", projectOverride(ctx), "Enregistrer mes changements")], { critical: true });
      const previous = ctx.state.extraEnv;
      ctx.state.extraEnv = { ...previous, DMS_LANG_EDITABLE: "false" };
      try {
        await ctx.restartBackend();
        await ctx.api("sign in again", { method: "GET", path: "/api/auth/me" });
        const listed = await lang(ctx, "list the workspaces", "GET", "/workspaces");
        const flat = await lang(ctx, "read the keys", "GET", `/flat?workspace=${id}`);
        /** @type {Record<string, any>[]} */
        const workspaces = list(listed.body, "workspaces");
        await ctx.verify("the module reports itself read-only and still reads", [
          ctx.equal("editable", pick(listed.body, "editable"), false),
          ctx.equal("the modules workspace", workspaces.find((workspace) => workspace.id === "modules")?.editable, false),
          ctx.equal("rows", pick(flat.body, "rows"), [
            { key: "a.b", values: { en: "Hello", fr: "Bonjour" } },
            { key: "a.e", values: { en: "Only English" } },
          ]),
        ]);
        const writes = /** @type {[string, string, string, unknown][]} */ ([
          ["create a workspace", "POST", "/workspace", { id: freshId(ctx, "x"), locale: { code: "en" } }],
          ["rename the workspace", "POST", "/workspace/rename", { id, newId: freshId(ctx, "y") }],
          ["delete the workspace", "DELETE", "/workspace", { id }],
          ["import a backup", "POST", "/import", { id: freshId(ctx, "z"), messages: { en: { a: "b" } } }],
          ["add a language", "POST", "/locale", { workspace: id, code: "de" }],
          ["remove a language", "DELETE", `/languages/${id}/fr`, undefined],
          ["make a language the base", "POST", `/languages/${id}/fr/base`, undefined],
          ["create a key", "POST", "/key", { workspace: id, path: "a.c", values: { en: "x" } }],
          ["write a text", "PUT", "/key", { workspace: id, path: "a.b", values: { fr: "Salut" } }],
          ["rename a key", "POST", "/key/rename", { workspace: id, path: "a.b", newPath: "a.d" }],
          ["delete a key", "DELETE", "/key", { workspace: id, path: "a.b" }],
          ["change the description", "PATCH", "/workspace", { id, description: "Changed", type: "website" }],
          ["drop an override", "DELETE", "/key/override", { workspace: "default", path: OVERRIDDEN_KEY }],
          ["mark a key reviewed", "POST", "/key/reviewed", { workspace: id, path: "a.b", locales: ["fr"] }],
        ]);
        const tab = await ctx.tab("admin");
        await tab.signIn("admin");
        await tab.goto(`/modules/lang/translations?workspace=${id}`);
        await ctx.verify("the matrix tells the owner that editing is disabled and still shows the texts", [
          tab.shows(/Editing is disabled on this server/),
          tab.visible({ role: "gridcell", name: "Bonjour" }),
        ]);
        await ctx.verify("the matrix offers no editor: no cell opens for editing and the editing shortcuts are not listed", [
          tab.visible({ role: "button", name: "Bonjour" }, { hidden: true }),
          tab.visible({ role: "button", name: "Translate a.e into Français" }, { hidden: true }),
          tab.shows(/Save, next row/, { not: true }),
        ]);
        for (const [label, method, path, body] of writes) {
          const answer = await lang(ctx, label, method, path, body);
          await ctx.verify(`${label} is refused`, [ctx.equal("status and code", [answer.status, pick(answer.body, "code")], [403, "read_only"])]);
        }
        const served = await raw(ctx, "read the public file", { path: `/i18n/${id}/fr.json` });
        recordRaw(ctx, served, [ctx.equal("the public file answers", served.json, { a: { b: "Bonjour" } })]);
        const details = await lang(ctx, "read the workspace", "GET", `/workspace?workspace=${id}`);
        await ctx.verify("nothing was written", [
          ctx.equal("files", workspaceFiles(ctx, id), [".workspace.json", "en.json", "fr.json"]),
          ctx.equal("description and type", [pick(details.body, "description"), pick(details.body, "type")], [undefined, undefined]),
          ctx.equal("the override is still in the project files", projectOverride(ctx), "Enregistrer mes changements"),
        ]);
      } finally {
        ctx.state.extraEnv = previous;
        await ctx.restartBackend();
        resetProjectFiles(ctx);
      }
    },
  },
  {
    id: "read-only-by-default",
    title: "a module configured without editable starts read-only: it lists editable false and refuses a write with 403",
    entryPoint: "the module option editable, left out",
    async run(/** @type {Ctx} */ ctx) {
      const previous = ctx.state.extraEnv;
      ctx.state.extraEnv = { ...previous, DMS_LANG_EDITABLE: "default" };
      try {
        await ctx.restartBackend();
        await ctx.api("sign in again", { method: "GET", path: "/api/auth/me" });
        const listed = await lang(ctx, "list the workspaces", "GET", "/workspaces");
        const created = await lang(ctx, "create a workspace", "POST", "/workspace", { id: freshId(ctx, "x"), locale: { code: "en" } });
        await ctx.verify("the default is read-only", [
          ctx.equal("editable", pick(listed.body, "editable"), false),
          ctx.equal("create", [created.status, pick(created.body, "code")], [403, "read_only"]),
        ]);
      } finally {
        ctx.state.extraEnv = previous;
        await ctx.restartBackend();
      }
    },
  },
  {
    id: "permissions-follow-the-page-tree",
    title: "the workspaces answer names the permission id of each write, following the page tree",
    entryPoint: "GET /api/lang/translations/workspaces",
    async run(/** @type {Ctx} */ ctx) {
      const listed = await lang(ctx, "list the workspaces", "GET", "/workspaces");
      await ctx.verify("each write has the permission id the docs name", [
        ctx.equal("edit translations", pick(listed.body, "permissions", "editTranslations"), "modules.lang.translate.translations.scoped.matrix.edit"),
        ctx.equal("manage keys", pick(listed.body, "permissions", "manageKeys"), "modules.lang.translate.translations.scoped.matrix.keys"),
        ctx.equal("create a workspace", pick(listed.body, "permissions", "createWorkspace"), "modules.lang.manage.workspaces.list.create"),
        ctx.holds("every id starts with modules.lang.", Object.values(toRow(pick(listed.body, "permissions"))).every((id) => String(id).startsWith("modules.lang.")), JSON.stringify(pick(listed.body, "permissions"))),
      ]);
    },
  },
]);
