import { freshId, isRow, lang, list, pick, raw, recordRaw, seedWorkspace } from "../../lang.mjs";

/** @typedef {import("../../lang.mjs").Ctx} Ctx */

/**
 * @param {unknown} body A JSON answer with an `items` list
 * @returns {unknown[]} The id of each item
 */
function itemIds(body) {
  return list(body, "items").map((item) => item.id);
}

/** The read routes the extending page names, the errors they answer and the public 404. */
export const readJourneys = [
  {
    id: "read-routes-carry-what-the-docs-name",
    title: "each read route gives what the extending page says it does: the workspaces with their public base and permission ids, the summary, the overview figures, the language progress, the About card, the endpoint and the languages table",
    entryPoint: "GET /api/lang/translations/*",
    async run(/** @type {Ctx} */ ctx) {
      const id = freshId(ctx, "reads");
      await seedWorkspace(ctx, id, { locales: ["en", "fr"], keys: { "a.one": { en: "One", fr: "Un" }, "a.two": { en: "Two" } } });
      const workspaces = await lang(ctx, "list the workspaces", "GET", "/workspaces");
      const summary = await lang(ctx, "read the summary", "GET", "/summary");
      const kpis = await lang(ctx, "read the figures", "GET", `/kpis?workspace=${id}`);
      const stats = await lang(ctx, "read the language progress", "GET", `/locale-stats?workspace=${id}&locale=fr`);
      const about = await lang(ctx, "read the About card", "GET", `/about?workspace=${id}`);
      const endpoint = await lang(ctx, "read the endpoint", "GET", `/endpoint?workspace=${id}`);
      const languages = await lang(ctx, "read the languages table", "GET", `/languages?workspace=${id}`);
      const mine = list(summary.body, "workspaces").find((workspace) => workspace.id === id);
      await ctx.verify("the workspaces route gives the editable flag, the public base and the permission ids", [
        ctx.equal("editable", pick(workspaces.body, "editable"), true),
        ctx.holds("public base", String(pick(workspaces.body, "publicBaseUrl")).endsWith("/i18n"), String(pick(workspaces.body, "publicBaseUrl"))),
        ctx.equal("permission names", Object.keys(toRecord(pick(workspaces.body, "permissions"))).sort((left, right) => left.localeCompare(right)), ["createWorkspace", "deleteWorkspace", "editTranslations", "editWorkspace", "manageKeys", "manageLanguages", "renameWorkspace"]),
        ctx.equal("every kind is listed", list(workspaces.body, "workspaces").map((workspace) => workspace.kind).filter((kind, index, kinds) => kinds.indexOf(kind) === index).sort((left, right) => String(left).localeCompare(String(right))), ["added", "default", "modules"]),
      ]);
      await ctx.verify("the summary gives the locales, keys, coverage and missing count of a workspace", [
        ctx.equal("fields", mine && [mine.totalKeys, mine.translatedStrings, mine.missing, mine.coverage, mine.baseLocale, list(mine, "locales").length], [2, 3, 1, 50, "en", 2]),
      ]);
      await ctx.verify("the figures, the progress and the About card list their items", [
        ctx.equal("overview figures", itemIds(kpis.body), ["languages", "keys", "missing", "coverage"]),
        ctx.equal("language progress", itemIds(stats.body), ["coverage", "translated", "missing", "issues"]),
        ctx.equal("About", itemIds(about.body), ["kind", "editable", "keys", "strings", "folder"]),
        ctx.equal("endpoint", itemIds(endpoint.body), ["url", "example", "fallback", "access"]),
        ctx.holds("the endpoint URL ends with the workspace's pattern", list(endpoint.body, "items").some((item) => String(item.value).endsWith(`/i18n/${id}/{locale}.json`)), JSON.stringify(endpoint.body).slice(0, 200)),
        ctx.equal("languages table", list(languages.body, "results").map((row) => [row.code, row.isBase, row.translated, row.total]), [["en", true, 2, 2], ["fr", false, 1, 2]]),
      ]);
    },
  },
  {
    id: "errors-carry-a-message-key-and-a-code",
    title: "an unknown workspace answers 404 unknown_workspace with a $dms_lang.errors message key on every read route, the project files answer when ?workspace= is omitted, and the public 404 names the workspace and the locale",
    entryPoint: "GET /api/lang/translations/* and /i18n/<workspace>/<locale>.json",
    async run(/** @type {Ctx} */ ctx) {
      const id = freshId(ctx, "errs");
      await seedWorkspace(ctx, id, { locales: ["en"], keys: { "a.b": { en: "Hello" } } });
      for (const path of ["flat", "workspace", "namespaces", "languages", "kpis", "about", "endpoint", "export", "backup"]) {
        const answer = await lang(ctx, `read ${path} of a missing workspace`, "GET", `/${path}?workspace=nope-${id}`);
        await ctx.verify(`${path} answers unknown_workspace`, [ctx.equal("status, code and key", [answer.status, pick(answer.body, "code"), pick(answer.body, "message")], [404, "unknown_workspace", "$dms_lang.errors.unknown_workspace"])]);
      }
      const omitted = await lang(ctx, "read the keys without a workspace", "GET", "/flat");
      await ctx.verify("without ?workspace= the project files answer", [ctx.status(omitted, 200), ctx.holds("project files' keys", list(omitted.body, "rows").some((row) => row.key === "dms.button.save_changes") || list(omitted.body, "rows").length > 0, "no rows")]);
      const missing = await raw(ctx, "read a language the workspace does not have", { path: `/i18n/${id}/de.json` });
      recordRaw(ctx, missing, [ctx.equal("status", missing.status, 404), ctx.equal("body", missing.json, { workspace: id, locale: "de", message: "$dms_lang.errors.unknown_locale", code: "unknown_locale" })]);
    },
  },
];

/**
 * @param {unknown} value A JSON value
 * @returns {Record<string, unknown>} The value when it is an object, else an empty object
 */
function toRecord(value) {
  return isRow(value) ? value : {};
}
