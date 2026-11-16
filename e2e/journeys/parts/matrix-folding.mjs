import { freshId, lang } from "../../lang.mjs";

/** @typedef {import("../../lang.mjs").Ctx} Ctx */

/**
 * @param {Ctx} ctx The journey
 * @param {number} alpha Keys in the first namespace
 * @param {number} beta Keys in the second namespace
 * @returns {Promise<string>} A workspace of two namespaces, every key translated
 */
async function twoNamespaces(ctx, alpha, beta) {
  const id = freshId(ctx, "fold");
  /** @type {Record<string, Record<string, string>>} */
  const english = {};
  /** @type {Record<string, Record<string, string>>} */
  const french = {};
  for (const [namespace, count] of [["alpha", alpha], ["beta", beta]]) {
    english[namespace] = {};
    french[namespace] = {};
    for (let n = 0; n < count; n += 1) {
      english[namespace][`k${n}`] = `Text ${n}`;
      french[namespace][`k${n}`] = `Texte ${n}`;
    }
  }
  await lang(ctx, `import ${alpha + beta} keys`, "POST", "/import", {
    format: "dms-lang.workspace",
    version: 1,
    id,
    defaultLocale: "en",
    locales: [{ code: "en" }, { code: "fr" }],
    messages: { en: english, fr: french },
  });
  return id;
}

/** The matrix folds its namespace groups when it holds many keys. */
export const foldingJourneys = [
  {
    id: "groups-start-collapsed-above-300-keys",
    title: "with more than 300 keys in more than one namespace the groups start collapsed; with 300 they start open",
    entryPoint: "/modules/lang/translations",
    async run(/** @type {Ctx} */ ctx) {
      const many = await twoNamespaces(ctx, 151, 150);
      const few = await twoNamespaces(ctx, 150, 150);
      const tab = await ctx.tab("admin");
      await tab.signIn("admin");
      await tab.goto(`/modules/lang/translations?workspace=${many}`);
      await ctx.verify("301 keys: both groups are listed and closed", [
        tab.visible({ role: "button", name: /^alpha 151 keys/ }),
        tab.visible({ role: "button", name: /^beta 150 keys/ }),
        tab.visible({ role: "button", name: "Open alpha.k0 in the panel" }, { hidden: true }),
        tab.visible({ role: "button", name: "Open beta.k0 in the panel" }, { hidden: true }),
      ]);
      await tab.click({ role: "button", name: /^alpha 151 keys/ });
      await ctx.verify("a closed group opens on a click", [tab.visible({ role: "button", name: "Open alpha.k0 in the panel" })]);
      await tab.goto(`/modules/lang/translations?workspace=${few}`);
      await ctx.verify("300 keys: the first group starts open (the list shows 100 rows at a time)", [
        tab.visible({ role: "button", name: /^alpha 150 keys/ }),
        tab.visible({ role: "button", name: "Open alpha.k0 in the panel" }),
      ]);
    },
  },
];
