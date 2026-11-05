import { freshId, lang, pick, seedWorkspace } from "../../lang.mjs";

/** @typedef {import("../../lang.mjs").Ctx} Ctx */

/**
 * @param {Ctx} ctx The journey
 * @param {string} id The workspace
 * @param {string} path The key
 * @param {string} base Its English text
 * @param {string} french Its French text
 * @returns {Promise<boolean>} Whether the write reports an issue for French
 */
async function issuesOf(ctx, id, path, base, french) {
  await lang(ctx, `add ${path}`, "POST", "/key", { workspace: id, path, values: { en: base } });
  const written = await lang(ctx, `translate ${path}`, "PUT", "/key", { workspace: id, path, values: { fr: french } });
  const issues = pick(written.body, "row", "issues");
  return Array.isArray(issues) && issues.includes("fr");
}

/** What makes a translation an issue besides a placeholder: spaces at its ends, the number of plural forms, the implicit plural names. */
export const issueRuleJourneys = [
  {
    id: "edge-spaces-are-an-issue",
    title: "a translation with a space at an end the base text does not have is an issue; a base with the same space is not",
    entryPoint: "PUT /api/lang/translations/key",
    async run(/** @type {Ctx} */ ctx) {
      const id = freshId(ctx, "edges");
      await seedWorkspace(ctx, id, { locales: ["en", "fr"] });
      await ctx.verify("trailing and leading spaces are flagged, a space the base has is not", [
        ctx.equal("trailing", await issuesOf(ctx, id, "a.trailing", "Hello", "Salut "), true),
        ctx.equal("leading", await issuesOf(ctx, id, "a.leading", "Hello", " Salut"), true),
        ctx.equal("same trailing space as the base", await issuesOf(ctx, id, "a.same", "Hello ", "Salut "), false),
        ctx.equal("no spaces", await issuesOf(ctx, id, "a.plain", "Hello", "Salut"), false),
      ]);
    },
  },
  {
    id: "plural-forms-must-match-the-base",
    title: "a translation with another number of plural forms than the base is an issue; the same number is not",
    entryPoint: "PUT /api/lang/translations/key",
    async run(/** @type {Ctx} */ ctx) {
      const id = freshId(ctx, "forms");
      await seedWorkspace(ctx, id, { locales: ["en", "fr"] });
      await ctx.verify("one form against two is flagged, two against two is not, two against three is flagged", [
        ctx.equal("fewer forms", await issuesOf(ctx, id, "a.few", "one | many", "une"), true),
        ctx.equal("same forms", await issuesOf(ctx, id, "a.same", "one | many", "une | plusieurs"), false),
        ctx.equal("more forms", await issuesOf(ctx, id, "a.more", "one | many", "zero | une | plusieurs"), true),
      ]);
    },
  },
  {
    id: "plural-messages-may-use-count-and-n",
    title: "a plural translation may use {count} and {n} without the base naming them; a plain text may not",
    entryPoint: "PUT /api/lang/translations/key",
    async run(/** @type {Ctx} */ ctx) {
      const id = freshId(ctx, "implicit");
      await seedWorkspace(ctx, id, { locales: ["en", "fr"] });
      await ctx.verify("{n} and {count} are known in a plural message and unknown in a plain one", [
        ctx.equal("{n} in a plural", await issuesOf(ctx, id, "a.n", "no apples | many apples", "aucune | {n} pommes"), false),
        ctx.equal("{count} in a plural", await issuesOf(ctx, id, "a.count", "no apples | many apples", "aucune | {count} pommes"), false),
        ctx.equal("{n} in a plain text", await issuesOf(ctx, id, "a.plain", "Hello", "Salut {n}"), true),
        ctx.equal("another name in a plural", await issuesOf(ctx, id, "a.other", "no apples | many apples", "aucune | {total} pommes"), true),
      ]);
    },
  },
];
