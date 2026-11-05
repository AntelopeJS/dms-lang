import { readFileSync } from "node:fs";
import { join } from "node:path";
import { eventually, freshId, guarded, isRow, lang, parseJson, pick, seedWorkspace } from "../lang.mjs";

/** @typedef {import("../lang.mjs").Ctx} Ctx */

/**
 * What a subscriber of the module's own, registered by the playground on the topic the docs name, has heard.
 *
 * @param {Ctx} ctx The journey
 * @returns {Record<string, unknown>[]} The messages, oldest first
 */
function heard(ctx) {
  try {
    return readFileSync(join(ctx.state.home, "verify-realtime-heard.jsonl"), "utf8").split("\n").map(parseJson).filter(isRow);
  } catch {
    return [];
  }
}

/**
 * @param {Ctx} ctx The journey
 * @param {string} workspace The workspace
 * @param {string} key The key path a write changed
 * @returns {Promise<Record<string, unknown> | undefined>} The message the write published on the topic, once the subscriber heard it
 */
async function messageFor(ctx, workspace, key) {
  const find = () => heard(ctx).find((message) => pick(message, "payload", "workspace") === workspace && toKeys(message).includes(key));
  await eventually(async () => ({ status: find() ? 200 : 204, body: undefined, error: null }), (answer) => answer.status === 200, 15_000);
  return find();
}

/**
 * @param {Ctx} ctx The journey
 * @param {string} workspace The workspace
 * @param {string} key The key path a write changed
 * @returns {Promise<Record<string, unknown> | undefined>} The newest message for that key that carries a session, once the subscriber heard it
 */
async function sessionMessageFor(ctx, workspace, key) {
  const find = () => heard(ctx).filter((message) => pick(message, "payload", "workspace") === workspace && toKeys(message).includes(key) && pick(message, "payload", "session") !== undefined).at(-1);
  await eventually(async () => ({ status: find() ? 200 : 204, body: undefined, error: null }), (answer) => answer.status === 200, 15_000);
  return find();
}

/**
 * @param {Record<string, unknown>} message A message heard
 * @returns {unknown[]} The key paths its payload names
 */
function toKeys(message) {
  const keys = pick(message, "payload", "keys");
  return Array.isArray(keys) ? keys : [];
}

/** Every write publishes on the dms-lang.translations topic, so another tab sees it without reloading. */
export const journeys = guarded([
  {
    id: "another-tab-sees-an-edit",
    title: "a text saved in one tab, or by an API caller, shows in an open matrix tab without a reload",
    entryPoint: "the dms-lang.translations realtime topic",
    async run(/** @type {Ctx} */ ctx) {
      const id = freshId(ctx, "live");
      await seedWorkspace(ctx, id, { locales: ["en", "fr"], keys: { "a.one": { en: "One" }, "a.two": { en: "Two" } } });
      const writer = await ctx.tab("admin", "writer");
      await writer.signIn("admin");
      const reader = await ctx.tab("admin", "reader");
      await reader.goto(`/modules/lang/translations?workspace=${id}`);
      await ctx.verify("the reader sees both keys missing in French", [reader.visible({ role: "button", name: "Translate a.one into Français" }, { timeoutMs: 60_000 }), reader.visible({ role: "button", name: "Translate a.two into Français" }, { timeoutMs: 60_000 })], { critical: true });
      await writer.goto(`/modules/lang/translations?workspace=${id}`);
      await writer.click({ role: "button", name: "Translate a.one into Français" });
      await writer.fill({ role: "textbox", name: "Translate a.one into Français" }, "Un");
      await writer.press("Enter", { role: "textbox", name: "Translate a.one into Français" });
      await ctx.verify("the text saved in the writer's tab appears in the reader's tab", [reader.visible({ role: "button", name: "Un" }, { timeoutMs: 60_000 })]);
      await lang(ctx, "translate a.two through the API", "PUT", "/key", { workspace: id, path: "a.two", values: { fr: "Deux" } });
      await ctx.verify("a write through the API appears too", [reader.visible({ role: "button", name: "Deux" }, { timeoutMs: 60_000 })]);
    },
  },
  {
    id: "a-subscriber-hears-the-topic-by-its-name",
    title: "a module that subscribes to dms-lang.translations hears the key that a write changed",
    entryPoint: "SubscribeMessage(\"dms-lang.translations\") from another module, PUT and POST /key",
    async run(/** @type {Ctx} */ ctx) {
      const id = freshId(ctx, "topic");
      await seedWorkspace(ctx, id, { locales: ["en", "fr"], keys: { "a.one": { en: "One" } } });
      await lang(ctx, "translate a.one", "PUT", "/key", { workspace: id, path: "a.one", values: { fr: "Un" } });
      const saved = await messageFor(ctx, id, "a.one");
      await ctx.verify("the subscriber of the documented topic hears the write", [
        ctx.holds("a message names the workspace and the key", saved !== undefined, JSON.stringify(heard(ctx).slice(-3))),
        ctx.equal("the topic", pick(saved, "topic"), "dms-lang.translations"),
      ]);
      await lang(ctx, "create a.two", "POST", "/key", { workspace: id, path: "a.two", values: { en: "Two" } });
      const created = await messageFor(ctx, id, "a.two");
      await ctx.verify("a created key is announced on it too", [ctx.holds("a message names a.two", created !== undefined, JSON.stringify(heard(ctx).slice(-3)))]);
    },
  },
  {
    id: "the-message-is-named-changed-and-carries-the-session",
    title: "every write publishes a message of type changed whose payload carries the workspace, the keys and the realtime session of the writer: the tab's own, or the one an API caller sends",
    entryPoint: "the dms-lang.translations realtime topic",
    async run(/** @type {Ctx} */ ctx) {
      const id = freshId(ctx, "session");
      await seedWorkspace(ctx, id, { locales: ["en", "fr"], keys: { "a.one": { en: "One" }, "a.two": { en: "Two" } } });
      const tab = await ctx.tab("admin");
      await tab.signIn("admin");
      await tab.goto(`/modules/lang/translations?workspace=${id}`);
      await tab.visible({ role: "button", name: "Translate a.one into Français" }, { timeoutMs: 60_000 });
      await tab.page.waitForTimeout(5000);
      /** @type {string[]} */
      const sessions = [];
      tab.page.on("request", (request) => {
        if (request.method() === "PUT" && request.url().includes("/translations/key")) sessions.push(String(request.headers()["x-realtime-session"]));
      });
      await tab.click({ role: "button", name: "Translate a.one into Français" });
      await tab.fill({ role: "textbox", name: "Translate a.one into Français" }, "Un");
      await tab.press("Enter", { role: "textbox", name: "Translate a.one into Français" });
      const fromTab = await sessionMessageFor(ctx, id, "a.one");
      const session = pick(fromTab, "payload", "session");
      await ctx.verify("a write from the tab: type changed, workspace, keys and a session", [
        ctx.holds("heard", fromTab !== undefined, JSON.stringify(heard(ctx).slice(-3))),
        ctx.equal("type", pick(fromTab, "type"), "changed"),
        ctx.equal("workspace", pick(fromTab, "payload", "workspace"), id),
        ctx.equal("keys", pick(fromTab, "payload", "keys"), ["a.one"]),
        ctx.holds("session", String(session).length > 0 && session !== undefined, `message ${String(session)}, request headers ${sessions.join(",")}`),
      ]);
      const sent = Number(await tab.page.evaluate(async (/** @type {{ workspace: string }} */ body) => {
        const response = await fetch("/api/lang/translations/key", { method: "PUT", headers: { "content-type": "application/json", "x-realtime-session": "s1" }, body: JSON.stringify({ workspace: body.workspace, path: "a.two", values: { fr: "Deux" } }) });
        return response.status;
      }, { workspace: id }));
      const fromApi = await sessionMessageFor(ctx, id, "a.two");
      await ctx.verify("a write that sends x-realtime-session: s1 carries session s1", [ctx.equal("status", sent, 200), ctx.equal("session", pick(fromApi, "payload", "session"), "s1"), ctx.equal("type", pick(fromApi, "type"), "changed")]);
    },
  },
]);
