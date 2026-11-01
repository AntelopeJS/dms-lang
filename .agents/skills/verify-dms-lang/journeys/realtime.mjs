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
      await ctx.verify("the reader sees both keys missing in French", [reader.visible({ role: "button", name: "Translate a.one into Français" }), reader.visible({ role: "button", name: "Translate a.two into Français" })], { critical: true });
      await writer.goto(`/modules/lang/translations?workspace=${id}`);
      await writer.click({ role: "button", name: "Translate a.one into Français" });
      await writer.fill({ role: "textbox", name: "Translate a.one into Français" }, "Un");
      await writer.press("Enter", { role: "textbox", name: "Translate a.one into Français" });
      await ctx.verify("the text saved in the writer's tab appears in the reader's tab", [reader.visible({ role: "button", name: "Un" })]);
      await lang(ctx, "translate a.two through the API", "PUT", "/key", { workspace: id, path: "a.two", values: { fr: "Deux" } });
      await ctx.verify("a write through the API appears too", [reader.visible({ role: "button", name: "Deux" })]);
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
]);
