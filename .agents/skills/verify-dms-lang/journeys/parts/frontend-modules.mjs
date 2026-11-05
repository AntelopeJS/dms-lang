import { dashboardSession, forgetRegistrations, freshId, lang, pick, raw, recordRaw, renderedUrl, reregister, resetProjectFiles, seedWorkspace } from "../../lang.mjs";

/** @typedef {import("../../lang.mjs").Ctx} Ctx */
/** @typedef {import("../../lang.mjs").Answer} Answer */

/**
 * @param {Ctx} ctx The journey
 * @param {string} workspace The workspace
 * @param {string} key The key
 * @returns {() => Promise<Answer>} One read of the key's row
 */
function rowOf(ctx, workspace, key) {
  return () => lang(ctx, `read ${key} in ${workspace}`, "GET", `/row?workspace=${workspace}&key=${key}`);
}

/**
 * @param {Answer} answer A row read
 * @returns {unknown} The English text of the row, undefined when the workspace does not have the key
 */
function english(answer) {
  return pick(answer.body, "row", "values", "en");
}

/** Journeys of the project files that change the registered frontend modules or read the server's render. */
export const projectFileJourneys = [
  {
    id: "pages-arrive-rendered-by-the-server",
    title: "the frontend server renders the matrix and the queue filled, and a page opened without ?workspace= is sent by the server for the workspace used last, else the project files",
    entryPoint: "GET /modules/lang/translations and /modules/lang/language on the dashboard origin, without a browser",
    async run(/** @type {Ctx} */ ctx) {
      resetProjectFiles(ctx);
      const id = freshId(ctx, "ssr");
      await seedWorkspace(ctx, id, { locales: ["en", "fr"], keys: { "deck.title": { en: "Rendered deck", fr: "Pont rendu" }, "deck.empty": { en: "Nothing rendered yet" } } });
      const cookie = await dashboardSession(ctx);
      const matrix = await raw(ctx, "read the matrix as the server sends it", { origin: "web", path: `/modules/lang/translations?workspace=${id}`, headers: { cookie } });
      recordRaw(ctx, matrix, [
        ctx.equal("status", matrix.status, 200),
        ctx.holds("the rows are in the markup", matrix.text.includes("Open deck.title in the panel") && matrix.text.includes("Open deck.empty in the panel"), String(matrix.text.length)),
        ctx.holds("with their texts", matrix.text.includes("Pont rendu"), ""),
      ]);
      const queue = await raw(ctx, "read the queue as the server sends it", { origin: "web", path: `/modules/lang/language?workspace=${id}&locale=fr`, headers: { cookie } });
      recordRaw(ctx, queue, [ctx.equal("status", queue.status, 200), ctx.holds("the first missing key and its base text are in the page", queue.text.includes("deck.empty") && queue.text.includes("Nothing rendered yet"), String(queue.text.length))]);
      const last = await raw(ctx, "open the matrix without a workspace, the last one used being the new one", { origin: "web", path: "/modules/lang/translations", headers: { cookie: `${cookie}; dms-lang-workspace=${id}` } });
      const never = await raw(ctx, "open the matrix without a workspace, none used before", { origin: "web", path: "/modules/lang/translations", headers: { cookie } });
      recordRaw(ctx, last, [ctx.equal("the server sends the workspace used last", renderedUrl(last.text), `/modules/lang/translations?workspace=${id}`), ctx.holds("filled with its rows", last.text.includes("Open deck.title in the panel"), "")]);
      recordRaw(ctx, never, [ctx.equal("the server sends the project files", renderedUrl(never.text), "/modules/lang/translations?workspace=default"), ctx.holds("filled with their rows", never.text.includes("Open shop.title in the panel"), "")]);
    },
  },
  {
    id: "reregistering-changes-the-origin",
    title: "registering the project's frontend module again without dmsI18nAppLayer moves its keys to the installed modules, and flagging it again brings them back, its files unchanged",
    entryPoint: "AddFrontendModule called again while the backend runs",
    async run(/** @type {Ctx} */ ctx) {
      resetProjectFiles(ctx);
      forgetRegistrations(ctx);
      try {
        const before = await rowOf(ctx, "default", "shop.title")();
        await ctx.verify("the app's keys start in the project files", [ctx.equal("project files", english(before), "Shop")]);
        const moved = await reregister(ctx, "app-unflagged", rowOf(ctx, "modules", "shop.title"), (answer) => english(answer) === "Shop");
        const left = await rowOf(ctx, "default", "shop.title")();
        await ctx.verify("unflagged, the module's keys are installed-module texts", [ctx.equal("installed modules", english(moved), "Shop"), ctx.equal("project files", english(left), undefined)]);
        const back = await reregister(ctx, "app-flagged", rowOf(ctx, "default", "shop.title"), (answer) => english(answer) === "Shop");
        const gone = await rowOf(ctx, "modules", "shop.title")();
        await ctx.verify("flagged again, they are project files again", [ctx.equal("project files", english(back), "Shop"), ctx.equal("installed modules", english(gone), undefined)]);
      } finally {
        forgetRegistrations(ctx);
      }
    },
  },
  {
    id: "lower-priority-app-layer-merges-first",
    title: "a second flagged module of lower priority, registered after start, joins the project files, and the higher-priority module wins on a key both define",
    entryPoint: "AddFrontendModule of a lower-priority dmsI18nAppLayer module while the backend runs",
    async run(/** @type {Ctx} */ ctx) {
      resetProjectFiles(ctx);
      forgetRegistrations(ctx);
      try {
        const late = await reregister(ctx, "late-app-layer", rowOf(ctx, "default", "late.hello"), (answer) => english(answer) === "Hello from a late module");
        const shared = await rowOf(ctx, "default", "shop.title")();
        await ctx.verify("the late module's keys join the project files under the app's", [
          ctx.equal("its own key", english(late), "Hello from a late module"),
          ctx.equal("the key both define", english(shared), "Shop"),
        ]);
      } finally {
        forgetRegistrations(ctx);
      }
    },
  },
];

/** The installed-modules journey of a module the backend did not know at start. */
export const lateModuleJourneys = [
  {
    id: "a-module-registered-after-start-appears",
    title: "a frontend module registered after Lang started shows its texts in the installed modules without a restart",
    entryPoint: "AddFrontendModule of a new module while the backend runs",
    async run(/** @type {Ctx} */ ctx) {
      forgetRegistrations(ctx);
      try {
        const before = await rowOf(ctx, "modules", "late.hello")();
        await ctx.verify("the module is unknown at start", [ctx.equal("installed modules", english(before), undefined)]);
        const after = await reregister(ctx, "late-installed", rowOf(ctx, "modules", "late.hello"), (answer) => english(answer) === "Hello from a late module");
        const project = await rowOf(ctx, "default", "late.hello")();
        await ctx.verify("its texts are installed-module texts, not project files", [ctx.equal("installed modules", english(after), "Hello from a late module"), ctx.equal("project files", english(project), undefined)]);
      } finally {
        forgetRegistrations(ctx);
      }
    },
  },
];
