import { freshId, guarded, lang, list, pick, raw, recordRaw, seedWorkspace, toRow, workspaceFiles } from "../lang.mjs";

/** @typedef {import("../lang.mjs").Ctx} Ctx */

const BACKUP_FORMAT = "dms-lang.workspace";

/**
 * @param {Ctx} ctx The journey
 * @param {string} id The workspace
 */
async function shopWorkspace(ctx, id) {
  await lang(ctx, "create", "POST", "/workspace", { id, locale: { code: "en" }, description: "Shop texts", type: "website" });
  await lang(ctx, "add fr", "POST", "/locale", { workspace: id, code: "fr" });
  await lang(ctx, "add key", "POST", "/key", { workspace: id, path: "checkout.pay", values: { en: "Pay {price}", fr: "Payer {price}" } });
  await lang(ctx, "add key", "POST", "/key", { workspace: id, path: "checkout.cancel", values: { en: "Cancel" } });
}

/** Download backup and Import: a whole workspace in one JSON file. */
export const journeys = guarded([
  {
    id: "backup-restores-the-workspace",
    title: "a downloaded backup restores the deleted workspace with its languages, details and texts, or a copy under another name",
    entryPoint: "GET /api/lang/translations/backup, then POST /import",
    async run(/** @type {Ctx} */ ctx) {
      const id = freshId(ctx, "shop");
      await shopWorkspace(ctx, id);
      const backup = await lang(ctx, "download the backup", "GET", `/backup?workspace=${id}`);
      const expected = {
        format: BACKUP_FORMAT,
        version: 1,
        id,
        defaultLocale: "en",
        locales: [{ code: "en" }, { code: "fr" }],
        description: "Shop texts",
        type: "website",
        messages: { en: { checkout: { pay: "Pay {price}", cancel: "Cancel" } }, fr: { checkout: { pay: "Payer {price}" } } },
      };
      await ctx.verify("the backup is one JSON file with the format stamp, the languages and every text", [
        ctx.status(backup, 200),
        ctx.equal("the backup", backup.body, expected),
      ]);
      const flat = await lang(ctx, "read the keys before", "GET", `/flat?workspace=${id}`);
      await lang(ctx, "delete the workspace", "DELETE", "/workspace", { id });
      const restored = await lang(ctx, "import the backup", "POST", "/import", backup.body);
      const after = await lang(ctx, "read the keys after", "GET", `/flat?workspace=${id}`);
      const served = await raw(ctx, "read the restored French file", { path: `/i18n/${id}/fr.json` });
      recordRaw(ctx, served, [ctx.equal("served again", served.json, { checkout: { pay: "Payer {price}" } })]);
      await ctx.verify("the import restores the workspace as it was", [
        ctx.status(restored, 200),
        ctx.equal("summary", restored.body, { id, kind: "added", editable: true, defaultLocale: "en", locales: [{ code: "en" }, { code: "fr" }], description: "Shop texts", type: "website" }),
        ctx.equal("the keys", after.body, flat.body),
        ctx.equal("the files", workspaceFiles(ctx, id), [".workspace.json", "en.json", "fr.json"]),
      ]);
      const copyId = freshId(ctx, "copy");
      const copy = await lang(ctx, "import it under another name", "POST", "/import", { ...backup.body, id: copyId });
      const copyKeys = await lang(ctx, "read the copy", "GET", `/flat?workspace=${copyId}`);
      await ctx.verify("a copy under another name holds the same texts", [
        ctx.status(copy, 200),
        ctx.equal("the copy's rows", pick(copyKeys.body, "rows"), pick(flat.body, "rows")),
      ]);
    },
  },
  {
    id: "backup-refusals",
    title: "an import of another format, a newer version, a taken or reserved name or a broken message creates nothing",
    entryPoint: "POST /api/lang/translations/import",
    async run(/** @type {Ctx} */ ctx) {
      const id = freshId(ctx, "shop");
      await shopWorkspace(ctx, id);
      const backup = toRow((await lang(ctx, "download the backup", "GET", `/backup?workspace=${id}`)).body);
      /** @type {[string, Record<string, unknown>, number, string][]} */
      const cases = [
        ["a taken name", { ...backup }, 409, "workspace_exists"],
        ["a reserved name", { ...backup, id: "default" }, 400, "reserved_workspace"],
        ["another format", { ...backup, id: freshId(ctx, "a"), format: "other" }, 400, "invalid_body"],
        ["a newer version", { ...backup, id: freshId(ctx, "b"), version: 2 }, 400, "invalid_body"],
        ["a text that is not a string", { ...backup, id: freshId(ctx, "c"), messages: { en: { a: 5 } } }, 400, "invalid_value"],
        ["a message vue-i18n cannot compile", { ...backup, id: freshId(ctx, "d"), messages: { en: { a: "jane@example.com" } } }, 400, "invalid_message"],
        ["texts of a language the backup does not declare", { ...backup, id: freshId(ctx, "e"), messages: { en: { a: "x" }, de: { a: "y" } } }, 400, "undeclared_locale"],
      ];
      for (const [label, body, status, code] of cases) {
        const answer = await lang(ctx, `import ${label}`, "POST", "/import", body);
        await ctx.verify(`${label} is refused`, [ctx.equal("status and code", [answer.status, pick(answer.body, "code")], [status, code])]);
        const named = String(body.id);
        if (named !== id && named !== "default") {
          const absent = await lang(ctx, `look for ${named}`, "GET", `/workspace?workspace=${named}`);
          await ctx.verify(`${label} created no workspace`, [ctx.status(absent, 404), ctx.equal("folder", workspaceFiles(ctx, named), [])]);
        }
      }
      const newer = await lang(ctx, "import a newer version", "POST", "/import", { ...backup, id: freshId(ctx, "f"), version: 2 });
      await ctx.verify("the newer version is named in the answer", [ctx.holds("message", JSON.stringify(newer.body).includes("newer_backup"), JSON.stringify(newer.body).slice(0, 200))]);
    },
  },
  {
    id: "export-one-language-or-all",
    title: "the export is one language's tree or every language, and an unknown language is a 404",
    entryPoint: "GET /api/lang/translations/export",
    async run(/** @type {Ctx} */ ctx) {
      const id = freshId(ctx, "shop");
      await shopWorkspace(ctx, id);
      const french = await lang(ctx, "export French", "GET", `/export?workspace=${id}&locale=fr`);
      const everything = await lang(ctx, "export every language", "GET", `/export?workspace=${id}`);
      const german = await lang(ctx, "export German", "GET", `/export?workspace=${id}&locale=de`);
      await ctx.verify("one language, all languages, an unknown language", [
        ctx.equal("French", french.body, { checkout: { pay: "Payer {price}" } }),
        ctx.equal("all", everything.body, { en: { checkout: { pay: "Pay {price}", cancel: "Cancel" } }, fr: { checkout: { pay: "Payer {price}" } } }),
        ctx.equal("German", [german.status, pick(german.body, "code")], [404, "unknown_locale"]),
      ]);
    },
  },
  {
    id: "empty-workspace-roundtrip",
    title: "a workspace without keys exports empty trees, backs up and restores with its languages",
    entryPoint: "GET /api/lang/translations/backup of an empty workspace, then POST /import",
    async run(/** @type {Ctx} */ ctx) {
      const id = freshId(ctx, "empty");
      await seedWorkspace(ctx, id, { locales: ["en", "fr"] });
      const exported = await lang(ctx, "export every language", "GET", `/export?workspace=${id}`);
      const backup = await lang(ctx, "download the backup", "GET", `/backup?workspace=${id}`);
      await ctx.verify("empty trees for every language", [
        ctx.equal("export", exported.body, { en: {}, fr: {} }),
        ctx.equal("backup messages", pick(backup.body, "messages"), { en: {}, fr: {} }),
      ]);
      await lang(ctx, "delete it", "DELETE", "/workspace", { id });
      const restored = await lang(ctx, "import the backup", "POST", "/import", backup.body);
      await ctx.verify("the languages come back with no key", [ctx.equal("locales", list(restored.body, "locales").map((locale) => locale.code), ["en", "fr"]), ctx.equal("files", workspaceFiles(ctx, id), [".workspace.json", "en.json", "fr.json"])]);
      const minimal = await lang(ctx, "import with only an id and messages", "POST", "/import", { id: freshId(ctx, "min"), messages: { en: {} } });
      await ctx.verify("a backup needs no format stamp, no details and no languages list", [ctx.status(minimal, 200), ctx.equal("defaultLocale", pick(minimal.body, "defaultLocale"), "en")]);
    },
  },
]);
