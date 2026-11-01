import { freshId, guarded, lang, list, pick, raw, readLocaleFile, recordRaw, seedWorkspace, workspaceFiles } from "../lang.mjs";

/** @typedef {import("../lang.mjs").Ctx} Ctx */

/**
 * @param {Ctx} ctx The journey
 * @param {string} id The workspace
 * @returns {Promise<Record<string, any>>} The languages by code
 */
async function languagesOf(ctx, id) {
  const answer = await lang(ctx, "list the languages", "GET", `/languages?workspace=${id}`);
  return Object.fromEntries(list(answer.body, "results").map((row) => [String(row.code), row]));
}

/** The languages of a workspace: add, remove and choose the base. */
export const journeys = guarded([
  {
    id: "add-a-language",
    title: "a language added by BCP 47 code gets its own file, an empty column and a native name",
    entryPoint: "POST /api/lang/translations/locale",
    async run(/** @type {Ctx} */ ctx) {
      const id = freshId(ctx, "atlas");
      await seedWorkspace(ctx, id, { keys: { "home.title": { en: "Home" } } });
      const added = await lang(ctx, "add French", "POST", "/locale", { workspace: id, code: "fr" });
      const regional = await lang(ctx, "add Belgian French", "POST", "/locale", { workspace: id, code: "fr-BE" });
      const script = await lang(ctx, "add a language with a script", "POST", "/locale", { workspace: id, code: "zh-Hant" });
      const twice = await lang(ctx, "add French again", "POST", "/locale", { workspace: id, code: "fr" });
      const invalid = await lang(ctx, "add a code that is not a language", "POST", "/locale", { workspace: id, code: "not a code!" });
      const unknownWorkspace = await lang(ctx, "add to a workspace that does not exist", "POST", "/locale", { workspace: freshId(ctx, "no"), code: "fr" });
      await ctx.verify("a valid code is added, a duplicate or invalid one is refused", [
        ctx.equal("French", added.body, { code: "fr", sameLanguage: [] }),
        ctx.equal("a regional variant names its sibling", regional.body, { code: "fr-BE", sameLanguage: ["fr"] }),
        ctx.equal("a script variant", pick(script.body, "code"), "zh-Hant"),
        ctx.equal("twice", [twice.status, pick(twice.body, "code")], [409, "locale_exists"]),
        ctx.equal("invalid", [invalid.status, pick(invalid.body, "code")], [400, "invalid_locale"]),
        ctx.equal("unknown workspace", [unknownWorkspace.status, pick(unknownWorkspace.body, "code")], [404, "unknown_workspace"]),
      ]);
      const rows = await languagesOf(ctx, id);
      await ctx.verify("each language has a file, a native name and its coverage against the base", [
        ctx.equal("files", workspaceFiles(ctx, id), [".workspace.json", "en.json", "fr-BE.json", "fr.json", "zh-Hant.json"]),
        ctx.equal("French name", rows.fr?.name, "Français"),
        ctx.equal("Belgian French name", rows["fr-BE"]?.name, "Français (Belgique)"),
        ctx.equal("base flag", [rows.en?.isBase, rows.fr?.isBase], [true, false]),
        ctx.equal("French coverage", [rows.fr?.translated, rows.fr?.total, rows.fr?.missing, rows.fr?.coverage], [0, 1, 1, 0]),
        ctx.equal("base coverage", rows.en?.coverage, 100),
      ]);
    },
  },
  {
    id: "remove-a-language",
    title: "removing a language deletes its file and its public URL; the base language cannot be removed",
    entryPoint: "DELETE /api/lang/translations/languages/<workspace>/<code>",
    async run(/** @type {Ctx} */ ctx) {
      const id = freshId(ctx, "atlas");
      await seedWorkspace(ctx, id, { locales: ["en", "fr", "de"], keys: { "home.title": { en: "Home", fr: "Accueil", de: "Start" } } });
      const confirm = await lang(ctx, "ask what removing French costs", "GET", `/languages/${id}/fr/removal-confirm`);
      await ctx.verify("the confirmation names the file and the public URL it removes", [
        ctx.status(confirm, 200),
        ctx.equal("file", pick(confirm.body, "params", "file"), "fr.json"),
        ctx.equal("url", pick(confirm.body, "params", "url"), `${ctx.state.webUrl}/i18n/${id}/fr.json`),
      ]);
      const removed = await lang(ctx, "remove French", "DELETE", `/languages/${id}/fr`);
      const base = await lang(ctx, "remove the base language", "DELETE", `/languages/${id}/en`);
      const missing = await lang(ctx, "remove a language the workspace does not have", "DELETE", `/languages/${id}/it`);
      await ctx.verify("French is gone, the base stays", [
        ctx.status(removed, 200),
        ctx.equal("files", workspaceFiles(ctx, id), [".workspace.json", "de.json", "en.json"]),
        ctx.equal("the base language is refused", [base.status, pick(base.body, "code")], [409, "base_locale"]),
        ctx.equal("an unknown language", missing.status, 404),
        ctx.equal("German keeps its text", readLocaleFile(ctx, id, "de"), { home: { title: "Start" } }),
      ]);
      const gone = await raw(ctx, "read the removed language", { path: `/i18n/${id}/fr.json` });
      const kept = await raw(ctx, "read another language", { path: `/i18n/${id}/de.json` });
      recordRaw(ctx, gone, [ctx.equal("the removed language answers 404", gone.status, 404)]);
      recordRaw(ctx, kept, [ctx.equal("the other language still answers", kept.status, 200)]);
    },
  },
  {
    id: "make-a-language-the-base",
    title: "making a language the base measures every coverage against it",
    entryPoint: "POST /api/lang/translations/languages/<workspace>/<code>/base",
    async run(/** @type {Ctx} */ ctx) {
      const id = freshId(ctx, "atlas");
      await seedWorkspace(ctx, id, { locales: ["en", "fr"], keys: { "a.one": { en: "One", fr: "Un" }, "a.two": { en: "Two" }, "a.three": { fr: "Trois" } } });
      const before = await lang(ctx, "read the figures with English as base", "GET", `/flat?workspace=${id}`);
      const confirm = await lang(ctx, "ask what making French the base needs", "GET", `/languages/${id}/fr/base-confirm`);
      const made = await lang(ctx, "make French the base", "POST", `/languages/${id}/fr/base`);
      const after = await lang(ctx, "read the figures with French as base", "GET", `/flat?workspace=${id}`);
      const rows = await languagesOf(ctx, id);
      await ctx.verify("the base moves and the figures follow", [
        ctx.equal("base before", pick(before.body, "defaultLocale"), "en"),
        ctx.equal("keys missing in the English base before", pick(before.body, "baseMissing"), 1),
        ctx.equal("the confirmation counts what French lacks", pick(confirm.body, "missing"), 1),
        ctx.status(made, 200),
        ctx.equal("answer", made.body, { defaultLocale: "fr" }),
        ctx.equal("base after", pick(after.body, "defaultLocale"), "fr"),
        ctx.equal("keys missing in the French base", pick(after.body, "baseMissing"), 1),
        ctx.equal("the flags", [rows.en?.isBase, rows.fr?.isBase], [false, true]),
        ctx.equal("English now lacks the one key French has and English does not", rows.en?.missing, 1),
      ]);
      const unknown = await lang(ctx, "make an unknown language the base", "POST", `/languages/${id}/it/base`);
      await ctx.verify("an unknown language cannot become the base", [ctx.holds("refused", unknown.status !== null && unknown.status >= 400, String(unknown.status))]);
    },
  },
]);
