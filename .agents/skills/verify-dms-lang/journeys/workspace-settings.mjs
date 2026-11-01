import { eventually, freshId, guarded, lang, list, pick, raw, readLocaleFile, recordRaw, seedWorkspace, workspaceFiles } from "../lang.mjs";

/** @typedef {import("../lang.mjs").Ctx} Ctx */

/** The Workspaces page and the settings of one workspace. */
export const journeys = guarded([
  {
    id: "new-workspace-dialog",
    title: "New workspace previews the public URL, creates the workspace with its details and lists it as a card",
    entryPoint: "/modules/lang/workspaces > New workspace",
    async run(/** @type {Ctx} */ ctx) {
      const id = freshId(ctx, "partner");
      const tab = await ctx.tab("admin");
      await tab.signIn("admin");
      await tab.goto("/modules/lang/workspaces?action=new-workspace");
      await ctx.verify("the dialog opens on arrival and cannot be submitted without a name", [
        tab.visible({ role: "dialog", name: "New workspace" }),
        tab.enabled({ role: "button", name: "Create workspace" }, { disabled: true }),
      ]);
      await tab.fill({ role: "textbox", name: "Workspace name" }, id);
      await tab.fill({ role: "textbox", name: "Description" }, "Texts of the partner portal");
      await tab.check({ role: "radio", name: "Website" });
      await ctx.verify("the dialog previews the public URL the workspace will be served at", [tab.shows(new RegExp(`/i18n/${id}/\\{locale\\}\\.json`))]);
      await tab.click({ role: "button", name: "Create workspace" });
      const created = await lang(ctx, "read the workspace", "GET", `/workspace?workspace=${id}`);
      await ctx.verify("the workspace exists with English as base and the details given", [
        ctx.equal("summary", created.body, { id, kind: "added", editable: true, defaultLocale: "en", locales: [{ code: "en" }], description: "Texts of the partner portal", type: "website" }),
        ctx.equal("files", workspaceFiles(ctx, id), [".workspace.json", "en.json"]),
      ]);
      await tab.goto("/modules/lang/workspaces");
      await ctx.verify("the Workspaces page lists the three kinds of workspace", [
        tab.visible({ role: "heading", name: id }),
        tab.visible({ role: "heading", name: "Project files" }),
        tab.visible({ role: "heading", name: "Installed modules" }),
        tab.shows(/served publicly as json for your apps/i),
      ]);
    },
  },
  {
    id: "switch-the-current-workspace",
    title: "a page opened without ?workspace= goes to the workspace used last, and the scope bar switches to another",
    entryPoint: "/modules/lang/* without ?workspace=, Switch workspace",
    async run(/** @type {Ctx} */ ctx) {
      const id = freshId(ctx, "current");
      await seedWorkspace(ctx, id, { locales: ["en", "fr"], keys: { "a.b": { en: "Hello" } } });
      const tab = await ctx.tab("admin");
      await tab.signIn("admin");
      await tab.goto(`/modules/lang/overview?workspace=${id}`);
      await ctx.verify("the scope bar names the workspace", [tab.shows(new RegExp(`workspace\\s*${id}`, "i")), tab.shows(/editable\s*2 languages\s*1 key/i)]);
      await tab.goto("/modules/lang/translations");
      await ctx.verify("another page without the query lands on the same workspace", [tab.shows(new RegExp(`workspace\\s*${id}`, "i")), tab.visible({ role: "button", name: "Open a.b in the panel" })]);
      await tab.click({ role: "button", name: "Switch workspace" });
      await tab.click({ role: "menuitem", name: /^Project files/ });
      await ctx.verify("the switcher moves every page to the project files", [tab.shows(/workspace\s*project files/i), tab.visible({ role: "button", name: "Open shop.title in the panel" })]);
      await tab.goto("/modules/lang/overview");
      await ctx.verify("and the next page without the query follows", [tab.shows(/workspace\s*project files/i)]);
    },
  },
  {
    id: "settings-save-as-you-go",
    title: "the settings page saves a description and a type as soon as they change, and shows the folder and the figures",
    entryPoint: "/modules/lang/workspace",
    async run(/** @type {Ctx} */ ctx) {
      const id = freshId(ctx, "settings");
      await seedWorkspace(ctx, id, { locales: ["en", "fr"], keys: { "a.b": { en: "Hello", fr: "Salut" } } });
      const tab = await ctx.tab("admin");
      await tab.signIn("admin");
      await tab.goto(`/modules/lang/workspace?workspace=${id}`);
      await tab.click({ role: "radio", name: "Mobile app" });
      await eventually(() => lang(ctx, "wait for the type", "GET", `/workspace?workspace=${id}`), (answer) => pick(answer.body, "type") === "mobile");
      await tab.fill({ role: "textbox", name: "Texts of the iOS and Android app" }, "Texts of the shop");
      await tab.press("Tab", { role: "textbox", name: "Texts of the iOS and Android app" });
      await eventually(() => lang(ctx, "wait for the description", "GET", `/workspace?workspace=${id}`), (answer) => pick(answer.body, "description") === "Texts of the shop");
      await tab.reload();
      const saved = await lang(ctx, "read the workspace", "GET", `/workspace?workspace=${id}`);
      await ctx.verify("the details were saved without a Save button", [
        ctx.equal("description", pick(saved.body, "description"), "Texts of the shop"),
        ctx.equal("type", pick(saved.body, "type"), "mobile"),
        tab.shows(/kind\s*workspace/i),
        tab.shows(/editable\s*yes/i),
        tab.shows(new RegExp(`folder\\s*i18n-workspaces/${id}`, "i")),
        tab.shows(/keys\s*1\s*translated strings\s*2/i),
      ]);
    },
  },
  {
    id: "snippets-for-your-app",
    title: "the Use in your app card gives the public URL and a snippet for vue-i18n, i18next, fetch and curl",
    entryPoint: "/modules/lang/workspace > Use in your app",
    async run(/** @type {Ctx} */ ctx) {
      const id = freshId(ctx, "snip");
      await seedWorkspace(ctx, id, { locales: ["en", "fr"], keys: { "a.b": { en: "Hello", fr: "Salut" } } });
      const tab = await ctx.tab("admin");
      await tab.signIn("admin");
      await tab.goto(`/modules/lang/workspace?workspace=${id}`);
      await ctx.verify("the endpoint card gives the URL, an example and the fallback rule", [
        tab.shows(new RegExp(`/i18n/${id}/\\{locale\\}\\.json`)),
        tab.shows(new RegExp(`/i18n/${id}/en\\.json`)),
        tab.shows(/a regional code without its own file \(fr-be\) is served its language \(fr\); an unknown language answers 404/i),
        tab.shows(/public, no sign-in\. saved changes are served on the next request/i),
        tab.visible({ role: "tab", name: "vue-i18n" }),
        tab.visible({ role: "tab", name: "i18next" }),
        tab.visible({ role: "tab", name: "fetch" }),
        tab.visible({ role: "tab", name: "curl" }),
        tab.shows(/createI18n/),
      ]);
      await tab.click({ role: "tab", name: "curl" });
      await ctx.verify("the curl snippet fetches the base language", [tab.shows(new RegExp(`curl .*/i18n/${id}/en\\.json`))]);
      await tab.click({ role: "tab", name: "fetch" });
      await ctx.verify("the fetch snippet checks the status before reading messages", [tab.shows(/response\.ok|!response\.ok/)]);
      for (const kind of ["vue", "i18next", "fetch", "curl"]) {
        const snippet = await lang(ctx, `read the ${kind} snippet`, "GET", `/snippet?workspace=${id}&kind=${kind}`);
        await ctx.verify(`the ${kind} snippet carries the workspace URL`, [ctx.status(snippet, 200), ctx.holds("URL", String(pick(snippet.body, "code")).includes(`/i18n/${id}/`), String(pick(snippet.body, "code")).slice(0, 120))]);
      }
    },
  },
  {
    id: "rename-from-the-danger-zone",
    title: "Rename shows the URL before and after and moves the public URL; the old URL answers 404",
    entryPoint: "/modules/lang/workspace > Danger zone > Rename…",
    async run(/** @type {Ctx} */ ctx) {
      const id = freshId(ctx, "old");
      const target = freshId(ctx, "new");
      await seedWorkspace(ctx, id, { locales: ["en", "fr"], keys: { "a.b": { en: "Hello", fr: "Salut" } } });
      const tab = await ctx.tab("admin");
      await tab.signIn("admin");
      await tab.goto(`/modules/lang/workspace?workspace=${id}`);
      await tab.click({ role: "button", name: "Rename…" });
      await ctx.verify("the dialog starts on the current name and cannot rename to it", [
        tab.visible({ role: "dialog", name: `Rename ${id}` }),
        tab.shows(/this is the current name/i),
        tab.enabled({ role: "button", name: "Rename workspace" }, { disabled: true }),
      ]);
      await tab.fill({ role: "textbox", name: "Workspace name" }, target);
      await tab.shows(new RegExp(`After\\s*.*/i18n/${target}/`, "i"));
      await tab.click({ role: "button", name: "Rename workspace" });
      const oldUrl = await raw(ctx, "read the old URL", { path: `/i18n/${id}/fr.json` });
      const newUrl = await raw(ctx, "read the new URL", { path: `/i18n/${target}/fr.json` });
      recordRaw(ctx, oldUrl, [ctx.equal("the old URL answers 404", oldUrl.status, 404)]);
      recordRaw(ctx, newUrl, [ctx.equal("the new URL serves the texts", newUrl.json, { a: { b: "Salut" } })]);
      await ctx.verify("the files moved", [ctx.equal("old folder", workspaceFiles(ctx, id), []), ctx.equal("new folder", readLocaleFile(ctx, target, "fr"), { a: { b: "Salut" } })]);
    },
  },
  {
    id: "delete-needs-the-name-typed",
    title: "Delete lists what it removes and deletes only after the workspace name is typed",
    entryPoint: "/modules/lang/workspace > Danger zone > Delete…",
    async run(/** @type {Ctx} */ ctx) {
      const id = freshId(ctx, "doomed");
      await seedWorkspace(ctx, id, { locales: ["en", "fr"], keys: { "a.b": { en: "Hello", fr: "Salut" } } });
      const tab = await ctx.tab("admin");
      await tab.signIn("admin");
      await tab.goto(`/modules/lang/workspace?workspace=${id}`);
      await tab.click({ role: "button", name: "Delete…" });
      await ctx.verify("the dialog counts the files and strings and offers a backup first", [
        tab.visible({ role: "dialog", name: `Delete ${id}?` }),
        tab.shows(/language files deleted from disk\s*2/i),
        tab.shows(/translated strings lost\s*2/i),
        tab.visible({ role: "button", name: "Download backup (.json)" }),
      ]);
      await tab.fill({ role: "textbox", name: `Type ${id} to confirm` }, id.slice(0, -1));
      await tab.click({ role: "button", name: "Delete workspace" });
      const stillThere = await lang(ctx, "read the workspace", "GET", `/workspace?workspace=${id}`);
      await ctx.verify("a wrong name deletes nothing", [ctx.status(stillThere, 200)]);
      await tab.fill({ role: "textbox", name: `Type ${id} to confirm` }, id);
      await tab.click({ role: "button", name: "Delete workspace" });
      const gone = await lang(ctx, "read the workspace again", "GET", `/workspace?workspace=${id}`);
      const listing = await lang(ctx, "list the workspaces", "GET", "/workspaces");
      await ctx.verify("the right name deletes the workspace", [
        ctx.status(gone, 404),
        ctx.equal("listed", list(listing.body, "workspaces").some((workspace) => workspace.id === id), false),
        ctx.equal("files", workspaceFiles(ctx, id), []),
      ]);
    },
  },
]);
