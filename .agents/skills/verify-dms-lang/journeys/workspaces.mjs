import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PROJECT_FILES, freshId, guarded, lang, list, pick, projectLocalesDir, raw, readLocaleFile, recordRaw, seedWorkspace, workspaceFiles, workspacesDir } from "../lang.mjs";

/** @typedef {import("../lang.mjs").Ctx} Ctx */

/** The workspaces a person creates for their other apps: create, describe, rename and delete. */
export const journeys = guarded([
  {
    id: "create-and-list",
    title: "a created workspace is listed with its languages, details and public URL, and its files are stored",
    entryPoint: "POST /api/lang/translations/workspace, then GET /workspaces",
    async run(/** @type {Ctx} */ ctx) {
      const id = freshId(ctx, "partner");
      const created = await lang(ctx, "create the workspace", "POST", "/workspace", {
        id,
        locale: { code: "en" },
        description: "Texts of the partner app",
        type: "mobile",
      });
      await ctx.verify("the workspace is created with its details", [
        ctx.status(created, 200),
        ctx.equal("the summary", created.body, {
          id,
          kind: "added",
          editable: true,
          defaultLocale: "en",
          locales: [{ code: "en" }],
          description: "Texts of the partner app",
          type: "mobile",
        }),
      ]);
      const listed = await lang(ctx, "list the workspaces", "GET", "/workspaces");
      const all = list(listed.body, "workspaces");
      const entry = all.find((workspace) => workspace.id === id);
      await ctx.verify("the list holds the three kinds of workspace", [
        ctx.status(listed, 200),
        ctx.equal("the kinds, project files first and modules last", all.filter((workspace) => workspace.kind !== "added" || workspace.id === id).map((workspace) => workspace.kind), ["default", "added", "modules"]),
        ctx.equal("the public URL template of the created one", entry?.publicUrl, `${ctx.state.webUrl}/i18n/${id}/{locale}.json`),
        ctx.equal("the project files have no public URL", all.find((workspace) => workspace.id === "default")?.publicUrl, undefined),
        ctx.equal("the modules workspace is read-only", all.find((workspace) => workspace.id === "modules")?.editable, false),
        ctx.equal("the module is editable", pick(listed.body, "editable"), true),
      ]);
      await ctx.verify("the files are stored in the workspaces folder, one JSON file per language", [
        ctx.equal("the folder", workspaceFiles(ctx, id), [".workspace.json", "en.json"]),
        ctx.equal("the English file starts empty", readLocaleFile(ctx, id, "en"), {}),
      ]);
      const edited = await lang(ctx, "describe it again", "PATCH", "/workspace", { id, description: null, type: "" });
      await ctx.verify("an empty type and a null description clear the details", [
        ctx.status(edited, 200),
        ctx.equal("the summary", edited.body, { id, kind: "added", editable: true, defaultLocale: "en", locales: [{ code: "en" }] }),
      ]);
      const badType = await lang(ctx, "set an unknown type", "PATCH", "/workspace", { id, type: "desktop" });
      await ctx.verify("an unknown type is refused", [ctx.status(badType, 400), ctx.equal("code", pick(badType.body, "code"), "invalid_body")]);
    },
  },
  {
    id: "name-rules",
    title: "a workspace name takes lowercase letters, digits, dashes and underscores; reserved and taken names are refused",
    entryPoint: "POST /api/lang/translations/workspace",
    async run(/** @type {Ctx} */ ctx) {
      const unique = freshId(ctx, "rules");
      for (const bad of ["two words", "with/slash", "..", "émoji"]) {
        const answer = await lang(ctx, `create "${bad}"`, "POST", "/workspace", { id: bad, locale: { code: "en" } });
        await ctx.verify(`"${bad}" is refused`, [ctx.status(answer, 400), ctx.equal("code", pick(answer.body, "code"), "invalid_workspace_id")]);
      }
      for (const reserved of ["default", "modules"]) {
        const answer = await lang(ctx, `create ${reserved}`, "POST", "/workspace", { id: reserved, locale: { code: "en" } });
        await ctx.verify(`${reserved} is reserved`, [ctx.status(answer, 400), ctx.equal("code", pick(answer.body, "code"), "reserved_workspace")]);
      }
      const mixed = `${unique}_A-1`;
      const created = await lang(ctx, "create a name with capitals, a dash and an underscore", "POST", "/workspace", { id: mixed, locale: { code: "en" } });
      await ctx.verify("the name is kept in lowercase", [ctx.status(created, 200), ctx.equal("id", pick(created.body, "id"), mixed.toLowerCase())]);
      const again = await lang(ctx, "create it again in other letters", "POST", "/workspace", { id: mixed.toUpperCase(), locale: { code: "en" } });
      await ctx.verify("a taken name is refused whatever its case", [ctx.status(again, 409), ctx.equal("code", pick(again.body, "code"), "workspace_exists")]);
      const noLocale = await lang(ctx, "create without a base language", "POST", "/workspace", { id: `${unique}-b`, locale: { code: "" } });
      await ctx.verify("a base language is required", [ctx.status(noLocale, 400)]);
    },
  },
  {
    id: "rename-moves-the-public-url",
    title: "renaming a workspace moves its files and its public URL, and the old URL stops answering",
    entryPoint: "POST /api/lang/translations/workspace/rename",
    async run(/** @type {Ctx} */ ctx) {
      const id = freshId(ctx, "before");
      const target = freshId(ctx, "after");
      const taken = freshId(ctx, "taken");
      await seedWorkspace(ctx, id, { locales: ["en", "fr"], keys: { "cart.empty": { en: "Your cart is empty", fr: "Votre panier est vide" } } });
      await seedWorkspace(ctx, taken);
      const renamed = await lang(ctx, "rename it", "POST", "/workspace/rename", { id, newId: target });
      await ctx.verify("the summary carries the new id and the same languages", [
        ctx.status(renamed, 200),
        ctx.equal("id", pick(renamed.body, "id"), target),
        ctx.equal("languages", pick(renamed.body, "locales"), [{ code: "en" }, { code: "fr" }]),
      ]);
      const oldUrl = await raw(ctx, "read the old URL", { path: `/i18n/${id}/fr.json` });
      const newUrl = await raw(ctx, "read the new URL", { path: `/i18n/${target}/fr.json` });
      recordRaw(ctx, oldUrl, [ctx.equal("the old URL answers 404", oldUrl.status, 404)]);
      recordRaw(ctx, newUrl, [ctx.equal("the new URL answers 200", newUrl.status, 200), ctx.equal("with the same texts", newUrl.json, { cart: { empty: "Votre panier est vide" } })]);
      await ctx.verify("the folder moved", [
        ctx.equal("the old folder is gone", workspaceFiles(ctx, id), []),
        ctx.equal("the new folder holds the files", workspaceFiles(ctx, target), [".workspace.json", "en.json", "fr.json"]),
      ]);
      const onto = await lang(ctx, "rename onto a taken name", "POST", "/workspace/rename", { id: target, newId: taken });
      const reserved = await lang(ctx, "rename onto a reserved name", "POST", "/workspace/rename", { id: target, newId: "default" });
      const missing = await lang(ctx, "rename a workspace that does not exist", "POST", "/workspace/rename", { id, newId: freshId(ctx, "x") });
      await ctx.verify("a taken, reserved or unknown name is refused", [
        ctx.equal("taken", [onto.status, pick(onto.body, "code")], [409, "workspace_exists"]),
        ctx.equal("reserved", [reserved.status, pick(reserved.body, "code")], [400, "reserved_workspace"]),
        ctx.equal("unknown", [missing.status, pick(missing.body, "code")], [404, "unknown_workspace"]),
      ]);
    },
  },
  {
    id: "delete-removes-everything",
    title: "deleting a workspace removes its files and its public URL and leaves the other workspaces and the project files alone",
    entryPoint: "DELETE /api/lang/translations/workspace",
    async run(/** @type {Ctx} */ ctx) {
      const doomed = freshId(ctx, "doomed");
      const kept = freshId(ctx, "kept");
      await seedWorkspace(ctx, doomed, { locales: ["en", "fr"], keys: { "a.b": { en: "A", fr: "B" } } });
      await seedWorkspace(ctx, kept, { locales: ["en"], keys: { "a.b": { en: "Kept" } } });
      const before = readFileSync(join(projectLocalesDir(ctx), "app-fr-FR.json"), "utf8");
      const deleted = await lang(ctx, "delete the workspace", "DELETE", "/workspace", { id: doomed });
      const listing = await lang(ctx, "list the workspaces", "GET", "/workspaces");
      /** @type {string[]} */
      const ids = list(listing.body, "workspaces").map((workspace) => workspace.id);
      await ctx.verify("the workspace and its files are gone, the others stay", [
        ctx.status(deleted, 200),
        ctx.equal("its folder", workspaceFiles(ctx, doomed), []),
        ctx.holds("the list drops it", !ids.includes(doomed), ids.join(", ")),
        ctx.holds("the list keeps the other workspace and the project files", ids.includes(kept) && ids.includes("default"), ids.join(", ")),
        ctx.equal("the other workspace's files", workspaceFiles(ctx, kept), [".workspace.json", "en.json"]),
        ctx.equal("the project file is untouched", readFileSync(join(projectLocalesDir(ctx), "app-fr-FR.json"), "utf8"), before),
      ]);
      const gone = await raw(ctx, "read the deleted workspace", { path: `/i18n/${doomed}/fr.json` });
      const still = await raw(ctx, "read the other workspace", { path: `/i18n/${kept}/en.json` });
      recordRaw(ctx, gone, [ctx.equal("the deleted workspace answers 404", gone.status, 404)]);
      recordRaw(ctx, still, [ctx.equal("the other workspace answers its texts", still.json, { a: { b: "Kept" } })]);
      const twice = await lang(ctx, "delete it again", "DELETE", "/workspace", { id: doomed });
      await ctx.verify("deleting again says the workspace is unknown", [ctx.equal("answer", [twice.status, pick(twice.body, "code")], [404, "unknown_workspace"])]);
    },
  },
  {
    id: "stored-files-stay-readable",
    title: "a workspace folder written by hand in the stored layout is listed and served, and the module writes the same layout",
    entryPoint: "<workspacesDir>/<workspace>/<locale>.json and .workspace.json",
    async run(/** @type {Ctx} */ ctx) {
      const id = freshId(ctx, "handmade");
      const folder = workspacesDir(ctx, id);
      mkdirSync(folder, { recursive: true });
      writeFileSync(join(folder, "en.json"), `${JSON.stringify({ home: { title: "Home", intro: "Welcome {name}" } }, null, "\t")}\n`);
      writeFileSync(join(folder, "fr.json"), `${JSON.stringify({ home: { title: "Accueil" } }, null, "\t")}\n`);
      writeFileSync(join(folder, ".workspace.json"), `${JSON.stringify({ defaultLocale: "en", locales: [{ code: "en" }, { code: "fr" }] }, null, "\t")}\n`);
      const summary = await lang(ctx, "read the summary", "GET", `/workspace?workspace=${id}`);
      const flat = await lang(ctx, "read the keys", "GET", `/flat?workspace=${id}`);
      await ctx.verify("the module lists the folder as a workspace with its keys", [
        ctx.equal("summary", [pick(summary.body, "id"), pick(summary.body, "kind"), pick(summary.body, "defaultLocale"), pick(summary.body, "locales")], [id, "added", "en", [{ code: "en" }, { code: "fr" }]]),
        ctx.equal("rows", list(flat.body, "rows").map((row) => [row.key, row.values]), [["home.title", { en: "Home", fr: "Accueil" }], ["home.intro", { en: "Welcome {name}" }]]),
        ctx.equal("missing French", pick(flat.body, "localeMissing"), { en: 0, fr: 1 }),
      ]);
      const served = await raw(ctx, "read the French file", { path: `/i18n/${id}/fr.json` });
      recordRaw(ctx, served, [ctx.equal("served as it is stored", served.json, { home: { title: "Accueil" } })]);
      await lang(ctx, "translate the missing key", "PUT", "/key", { workspace: id, path: "home.intro", values: { fr: "Bienvenue {name}" } });
      await ctx.verify("the module keeps the stored layout when it writes", [
        ctx.equal("folder", workspaceFiles(ctx, id), [".workspace.json", "en.json", "fr.json"]),
        ctx.equal("the French file", readLocaleFile(ctx, id, "fr"), { home: { title: "Accueil", intro: "Bienvenue {name}" } }),
        ctx.equal("the manifest keeps the languages", JSON.parse(readFileSync(join(folder, ".workspace.json"), "utf8")).locales, [{ code: "en" }, { code: "fr" }]),
        ctx.holds("files are tab-indented JSON ending with a newline", readFileSync(join(folder, "fr.json"), "utf8").startsWith('{\n\t"home": {\n\t\t"title"') && readFileSync(join(folder, "fr.json"), "utf8").endsWith("}\n"), readFileSync(join(folder, "fr.json"), "utf8")),
      ]);
      await lang(ctx, "add German", "POST", "/locale", { workspace: id, code: "de" });
      const empty = readFileSync(join(folder, "de.json"), "utf8");
      await lang(ctx, "translate a key into German", "PUT", "/key", { workspace: id, path: "home.title", values: { de: "Start" } });
      await ctx.verify("a new language file starts tab-indented with a final newline", [
        ctx.equal("empty file", empty, "{}\n"),
        ctx.equal("file with a text", readFileSync(join(folder, "de.json"), "utf8"), '{\n\t"home": {\n\t\t"title": "Start"\n\t}\n}\n'),
      ]);
      await ctx.verify("the project files are not mixed with the workspaces", [
        ctx.equal("names", Object.keys(PROJECT_FILES), ["app-en-GB.json", "app-fr-FR.json"]),
      ]);
    },
  },
  {
    id: "types-accepted",
    title: "a workspace is described as DMS, Website, Mobile app or Other; any other type is refused",
    entryPoint: "POST /api/lang/translations/workspace with a type",
    async run(/** @type {Ctx} */ ctx) {
      for (const type of ["dms", "website", "mobile", "other"]) {
        const created = await lang(ctx, `create a ${type} workspace`, "POST", "/workspace", { id: freshId(ctx, type), locale: { code: "en" }, type });
        await ctx.verify(`${type} is accepted`, [ctx.status(created, 200), ctx.equal("type", pick(created.body, "type"), type)]);
      }
      const bad = await lang(ctx, "create a desktop workspace", "POST", "/workspace", { id: freshId(ctx, "desktop"), locale: { code: "en" }, type: "desktop" });
      await ctx.verify("an unknown type is refused", [ctx.equal("status and code", [bad.status, pick(bad.body, "code")], [400, "invalid_body"])]);
    },
  },
  {
    id: "dialog-checks-the-name-live",
    title: "the New workspace dialog tells a taken name and a reserved or malformed one before anything is created",
    entryPoint: "/modules/lang/workspaces?action=new-workspace",
    async run(/** @type {Ctx} */ ctx) {
      const taken = freshId(ctx, "taken");
      await seedWorkspace(ctx, taken);
      const tab = await ctx.tab("admin");
      await tab.signIn("admin");
      await tab.goto("/modules/lang/workspaces?action=new-workspace");
      await tab.fill({ role: "textbox", name: "Workspace name" }, taken);
      await ctx.verify("a taken name is named as existing", [tab.shows(new RegExp(`a workspace named ${taken} already exists`, "i"))]);
      for (const reserved of ["default", "modules", "two words"]) {
        await tab.fill({ role: "textbox", name: "Workspace name" }, reserved);
        await ctx.verify(`"${reserved}" gets the naming rule`, [tab.shows(/lowercase letters, digits, dashes and underscores; default, modules and all are reserved/i)]);
      }
      await tab.fill({ role: "textbox", name: "Workspace name" }, freshId(ctx, "free"));
      await ctx.verify("a free name is announced as available", [tab.shows(/is available/i)]);
    },
  },
]);
