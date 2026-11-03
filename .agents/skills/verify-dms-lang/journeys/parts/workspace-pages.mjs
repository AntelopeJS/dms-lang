import { allowClipboard, chooseFile, copiedBy, currentUrl, readOnlyValues } from "../../files.mjs";
import { clickUntil, eventually, freshId, lang, list, pick, readLocaleFile, seedWorkspace } from "../../lang.mjs";

/** @typedef {import("../../lang.mjs").Ctx} Ctx */

/**
 * @param {Ctx} ctx The journey
 * @param {import("../../lang.mjs").Tab} tab The tab on the Workspaces page
 * @param {string} name The file name
 * @param {unknown} content What the file holds
 * @returns {Promise<boolean>} Whether the chooser opened
 */
function chooseJson(ctx, tab, name, content) {
  return chooseFile(tab, { role: "button", name: "Import…" }, { name, mimeType: "application/json", buffer: Buffer.from(JSON.stringify(content)) });
}

/**
 * Deletes every workspace created earlier in the run, so a journey can count them.
 *
 * @param {Ctx} ctx The journey
 * @returns {Promise<number>} How many workspaces are left (the project files and the installed modules)
 */
async function deleteCreated(ctx) {
  const before = await lang(ctx, "list the workspaces", "GET", "/workspaces");
  for (const workspace of list(before.body, "workspaces")) {
    if (workspace.kind === "added") await lang(ctx, `delete ${String(workspace.id)}`, "DELETE", "/workspace", { id: workspace.id });
  }
  return list((await lang(ctx, "list what is left", "GET", "/workspaces")).body, "workspaces").length;
}

/** The Workspaces page's buttons and name limit, the Import dialog's readings, and the settings page's explanations. */
export const pageJourneys = [
  {
    id: "card-buttons-switch-browse-and-open",
    title: "a card's button reads Switch, Browse on the installed modules and Open on the current workspace, and Browse opens the matrix",
    entryPoint: "/modules/lang/workspaces",
    async run(/** @type {Ctx} */ ctx) {
      const id = freshId(ctx, "current");
      await seedWorkspace(ctx, id, { locales: ["en"], keys: { "a.b": { en: "Hello" } } });
      const tab = await ctx.tab("admin");
      await tab.signIn("admin");
      await tab.goto(`/modules/lang/workspaces?workspace=${id}`);
      await ctx.verify("Open on the current workspace, Browse on the modules, Switch elsewhere", [
        tab.visible({ role: "button", name: "Open", exact: true }),
        tab.visible({ role: "button", name: "Browse", exact: true }),
        tab.visible({ role: "button", name: "Switch", exact: true, nth: 0 }),
        tab.shows(/Current/),
      ]);
      await tab.click({ role: "button", name: "Browse", exact: true });
      await ctx.verify("Browse opens the matrix of the installed modules", [tab.at(/^\/modules\/lang\/translations$/), tab.shows(/Read-only/), tab.shows(/workspace\s*installed modules/i)]);
    },
  },
  {
    id: "name-length-and-first-character",
    title: "a workspace name has at most 64 characters and starts with a letter or a digit; the dialog refuses the same names",
    entryPoint: "POST /api/lang/translations/workspace, /modules/lang/workspaces?action=new-workspace",
    async run(/** @type {Ctx} */ ctx) {
      const longest = `l${freshId(ctx, "x").replace(/[^a-z0-9]/g, "")}`.padEnd(64, "z").slice(0, 64);
      const tooLong = `${longest}z`;
      const cases = /** @type {[string, string, number][]} */ ([
        ["64 characters", longest, 200],
        ["65 characters", tooLong, 400],
        ["a leading dash", "-lead", 400],
        ["a leading underscore", "_lead", 400],
        ["a leading digit", `${freshId(ctx, "d")}`.replace(/^[a-z]+-/, "9"), 200],
      ]);
      for (const [label, name, status] of cases) {
        const answer = await lang(ctx, `create ${label}`, "POST", "/workspace", { id: name, locale: { code: "en" } });
        await ctx.verify(`${label}: ${status === 200 ? "accepted" : "refused"}`, [ctx.status(answer, status)]);
      }
      const tab = await ctx.tab("admin");
      await tab.signIn("admin");
      await tab.goto("/modules/lang/workspaces?action=new-workspace");
      await tab.fill({ role: "textbox", name: "Workspace name" }, tooLong);
      await ctx.verify("65 characters cannot be created from the dialog", [tab.enabled({ role: "button", name: "Create workspace" }, { disabled: true })]);
      await tab.fill({ role: "textbox", name: "Workspace name" }, `${longest.slice(0, 60)}dlg`.slice(0, 63).padEnd(64, "y"));
      await ctx.verify("64 characters can", [tab.enabled({ role: "button", name: "Create workspace" })]);
    },
  },
  {
    id: "import-refuses-files-that-are-no-workspace",
    title: "Import says a JSON that is neither a backup nor a JSON of languages is none, and a backup of a newer version asks to update the module; neither opens the dialog",
    entryPoint: "/modules/lang/workspaces > Import…",
    async run(/** @type {Ctx} */ ctx) {
      const tab = await ctx.tab("admin");
      await tab.signIn("admin");
      await tab.goto("/modules/lang/workspaces");
      const opened = await chooseJson(ctx, tab, "notes.json", { hello: 5 });
      await ctx.verify("a file that is no workspace is named and explained", [
        ctx.holds("file chooser", opened, "no file chooser opened"),
        tab.shows(/notes\.json is neither a workspace backup nor a JSON of languages/),
        tab.shows(/Expected a backup downloaded from a workspace/),
        tab.visible({ role: "dialog", name: "Import a workspace" }, { hidden: true }),
      ]);
      await tab.goto("/modules/lang/workspaces");
      await chooseJson(ctx, tab, "future.json", { format: "dms-lang.workspace", version: 2, id: freshId(ctx, "future"), messages: { en: { a: "x" } } });
      await ctx.verify("a newer backup asks to update the module", [
        tab.shows(/future\.json was saved by a newer version of the Translations module/),
        tab.shows(/Update the module on this server to import this backup/),
        tab.visible({ role: "dialog", name: "Import a workspace" }, { hidden: true }),
      ]);
    },
  },
  {
    id: "import-reads-a-json-of-languages",
    title: "Import reads a JSON holding one object per language code, offers the file's languages and creates the workspace under the typed name",
    entryPoint: "/modules/lang/workspaces > Import…",
    async run(/** @type {Ctx} */ ctx) {
      const id = freshId(ctx, "langs");
      const tab = await ctx.tab("admin");
      await tab.signIn("admin");
      await tab.goto("/modules/lang/workspaces");
      await chooseJson(ctx, tab, "export.json", { en: { shop: { title: "Shop" } }, fr: { shop: { title: "Boutique" } } });
      await ctx.verify("the dialog counts the file's two languages", [tab.visible({ role: "dialog", name: "Import a workspace" }), tab.shows(/Creates a workspace from the file and its 2 languages/)]);
      await tab.fill({ role: "textbox", name: "Workspace name" }, id);
      await tab.click({ role: "button", name: "Import workspace" });
      const created = await eventually(() => lang(ctx, "read the imported workspace", "GET", `/workspace?workspace=${id}`), (answer) => answer.status === 200);
      await ctx.verify("both languages are there", [ctx.equal("locales", list(created.body, "locales").map((locale) => String(locale.code)).sort((left, right) => left.localeCompare(right)), ["en", "fr"]), ctx.equal("base", pick(created.body, "defaultLocale"), "en")]);
    },
  },
  {
    id: "settings-page-explains-itself",
    title: "the settings page links to the overview, keeps the name read-only with its warning, lists the languages with their coverage, and shows the About card; the project files show where their texts live instead",
    entryPoint: "/modules/lang/workspace",
    async run(/** @type {Ctx} */ ctx) {
      const id = freshId(ctx, "about");
      await seedWorkspace(ctx, id, { locales: ["en", "fr"], keys: { "a.one": { en: "One", fr: "Un" }, "a.two": { en: "Two" } } });
      const tab = await ctx.tab("admin");
      await tab.signIn("admin");
      await tab.goto(`/modules/lang/workspace?workspace=${id}`);
      await ctx.verify("the name is a read-only field with its warning, and the languages table carries the coverage", [
        tab.visible({ role: "link", name: "Open overview" }),
        tab.shows(/Part of the public URL\. Renaming breaks apps still using the old one/),
        tab.shows(new RegExp(`One JSON file per language in i18n-workspaces/${id}`)),
        tab.visible({ role: "cell", name: "Français fr · 50% · 1 missing" }),
        tab.visible({ role: "button", name: "Rename…" }),
      ]);
      await ctx.verify("the read-only field holds the workspace name", [ctx.equal("read-only fields", await readOnlyValues(tab), id)]);
      await ctx.verify("the About card gives kind, editable, keys, translated strings and folder", [
        tab.shows(/About\s*Kind\s*Workspace\s*Editable\s*Yes\s*Keys\s*2\s*Translated strings\s*3\s*Folder\s*i18n-workspaces\//i),
        tab.shows(/Keys are shared by every language/),
      ]);
      await tab.click({ role: "link", name: "Open overview" });
      await ctx.verify("Open overview opens the overview", [tab.at(/^\/modules\/lang\/overview$/)]);
      await tab.goto("/modules/lang/workspace?workspace=default");
      await ctx.verify("the project files show where the texts live, with no name, description or type", [
        tab.shows(/Where the texts live/),
        tab.visible({ role: "radio", name: "Website" }, { hidden: true }),
        tab.visible({ role: "button", name: "Rename…" }, { hidden: true }),
      ]);
    },
  },
  {
    id: "copy-puts-the-url-and-the-setup-on-the-clipboard",
    title: "the Copy buttons of Use in your app put the public URL and the snippet on the clipboard",
    entryPoint: "/modules/lang/workspace > Use in your app > Copy",
    async run(/** @type {Ctx} */ ctx) {
      const id = freshId(ctx, "copied");
      await seedWorkspace(ctx, id, { locales: ["en", "fr"], keys: { "a.b": { en: "Hello" } } });
      const tab = await ctx.tab("admin");
      await tab.signIn("admin");
      await allowClipboard(ctx, tab);
      await tab.goto(`/modules/lang/workspace?workspace=${id}`);
      await tab.visible({ role: "tab", name: "vue-i18n" });
      const url = await copiedBy(tab, 0);
      const setup = await copiedBy(tab, 1);
      await ctx.verify("the first Copy gives the URL and the next one the setup", [
        ctx.holds("URL", url.endsWith(`/i18n/${id}/{locale}.json`), url),
        ctx.holds("vue-i18n setup", setup.includes("createI18n") && setup.includes(`/i18n/${id}/`), setup.slice(0, 120)),
      ]);
    },
  },
  {
    id: "scope-menu-gets-a-filter-from-seven-workspaces",
    title: "the workspace menu of the scope bar gets a filter field from seven workspaces on, and describes each workspace by its kind and languages",
    entryPoint: "/modules/lang/overview > Switch workspace",
    async run(/** @type {Ctx} */ ctx) {
      const kept = await deleteCreated(ctx);
      const names = [];
      for (let n = kept; n < 6; n += 1) {
        const name = freshId(ctx, "menu");
        names.push(name);
        await lang(ctx, `create ${name}`, "POST", "/workspace", { id: name, locale: { code: "en" } });
      }
      const tab = await ctx.tab("admin");
      await tab.signIn("admin");
      await tab.goto(`/modules/lang/overview?workspace=${names[0]}`);
      await clickUntil(tab, { role: "button", name: "Switch workspace" }, { role: "menu", name: "Switch workspace" });
      await ctx.verify("six workspaces: a plain menu with each workspace described", [
        tab.visible({ role: "searchbox", name: "Filter workspaces" }, { hidden: true }),
        tab.visible({ role: "menuitem", name: "Project files Project · 2 languages" }),
        tab.visible({ role: "menuitem", name: new RegExp(`^${names[1]} Workspace · 1 language$`) }),
      ]);
      const seventh = freshId(ctx, "menu");
      await lang(ctx, `create ${seventh}`, "POST", "/workspace", { id: seventh, locale: { code: "en" } });
      await tab.goto(`/modules/lang/overview?workspace=${names[0]}`);
      await clickUntil(tab, { role: "button", name: "Switch workspace" }, { role: "menu", name: "Switch workspace" });
      await ctx.verify("seven workspaces: a filter field", [tab.visible({ role: "searchbox", name: "Filter workspaces" })]);
      await tab.fill({ role: "searchbox", name: "Filter workspaces" }, seventh);
      await ctx.verify("typing narrows the menu", [tab.visible({ role: "menuitem", name: new RegExp(`^${seventh} `) }), tab.visible({ role: "menuitem", name: new RegExp(`^${names[1]} `) }, { hidden: true })]);
    },
  },
  {
    id: "switching-workspace-leaves-the-filters-behind",
    title: "switching workspace from the scope bar keeps the page and drops the filters and the search of the workspace left",
    entryPoint: "/modules/lang/translations > Switch workspace",
    async run(/** @type {Ctx} */ ctx) {
      const first = freshId(ctx, "left");
      const second = freshId(ctx, "arrived");
      await seedWorkspace(ctx, first, { locales: ["en", "fr"], keys: { "a.one": { en: "One" }, "a.two": { en: "Two", fr: "Deux" } } });
      await seedWorkspace(ctx, second, { locales: ["en", "fr"], keys: { "b.one": { en: "One" } } });
      const tab = await ctx.tab("admin");
      await tab.signIn("admin");
      await tab.goto(`/modules/lang/translations?workspace=${first}&filter=missing&q=One`);
      await clickUntil(tab, { role: "button", name: "Switch workspace" }, { role: "menu", name: "Switch workspace" });
      await tab.click({ role: "menuitem", name: new RegExp(`^${second} `) });
      await ctx.verify("the matrix of the other workspace opens with no filter or search", [
        tab.at(/^\/modules\/lang\/translations$/),
        ctx.holds("only the workspace in the URL", new RegExp(`workspace=${second}`).test(currentUrl(tab)) && !/filter=|q=/.test(currentUrl(tab)), currentUrl(tab)),
        tab.visible({ role: "button", name: "Open b.one in the panel" }),
      ]);
    },
  },
  {
    id: "import-reads-a-chosen-backup",
    title: "Import opens the file chooser, reads the chosen backup file and creates the workspace under its name",
    entryPoint: "/modules/lang/workspaces > Import…",
    async run(/** @type {Ctx} */ ctx) {
      const id = freshId(ctx, "chosen");
      const backup = {
        format: "dms-lang.workspace",
        version: 1,
        id,
        defaultLocale: "en",
        locales: [{ code: "en" }, { code: "fr" }],
        messages: { en: { shop: { title: "Shop" } }, fr: { shop: { title: "Boutique" } } },
      };
      const tab = await ctx.tab("admin");
      await tab.signIn("admin");
      await tab.goto("/modules/lang/workspaces");
      const chosen = await chooseFile(tab, { role: "button", name: "Import…" }, { name: `${id}.json`, mimeType: "application/json", buffer: Buffer.from(JSON.stringify(backup)) });
      await ctx.verify("Import opens the file chooser and takes the file", [ctx.holds("file chooser", chosen, "no file chooser opened")]);
      await ctx.verify("the dialog names the workspace it will create", [tab.visible({ role: "dialog", name: "Import a workspace" })]);
      await tab.click({ role: "button", name: "Import workspace" });
      const created = await eventually(() => lang(ctx, "read the imported workspace", "GET", `/workspace?workspace=${id}`), (answer) => answer.status === 200);
      const french = readLocaleFile(ctx, id, "fr");
      await ctx.verify("the workspace holds the file's languages and texts", [
        ctx.status(created, 200),
        ctx.equal("locales", list(created.body, "locales").map((locale) => locale.code), ["en", "fr"]),
        ctx.equal("French file", french, { shop: { title: "Boutique" } }),
      ]);
    },
  },
];
