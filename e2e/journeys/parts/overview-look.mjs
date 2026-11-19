import { heatTone } from "../../files.mjs";
import { clickUntil, freshId, lang } from "../../lang.mjs";

/**
 * @typedef {import("../../lang.mjs").Ctx} Ctx
 * @typedef {import("../../lang.mjs").Tab} Tab
 */

/**
 * @param {Ctx} ctx The journey
 * @param {string} id The workspace
 * @param {Record<string, Record<string, string>>} en English texts by namespace then key
 * @param {Record<string, Record<string, string>>} fr French texts by namespace then key
 */
async function importTrees(ctx, id, en, fr) {
  await lang(ctx, "import the trees", "POST", "/import", { format: "dms-lang.workspace", version: 1, id, defaultLocale: "en", locales: [{ code: "en" }, { code: "fr" }], messages: { en, fr } });
}

/** How the overview looks to an owner in another dashboard language or colour scheme. */
export const overviewLook = [
  {
    id: "the-pages-follow-the-dashboard-language",
    title: "an owner who picks français in the user menu gets every Lang page, its menu and its figures in French, with no untranslated text key",
    entryPoint: "user menu > Language > français, then each Lang page",
    async run(/** @type {Ctx} */ ctx) {
      const id = freshId(ctx, "francais");
      await importTrees(ctx, id, { shop: { pay: "Pay", cancel: "Cancel" } }, { shop: { pay: "Payer" } });
      const tab = await ctx.tab("admin");
      await tab.signIn("admin");
      await tab.goto(`/modules/lang/overview?workspace=${id}`);
      await clickUntil(tab, { role: "button", name: /^Verify Admin/ }, { role: "menuitem", name: "Language" });
      await tab.click({ role: "menuitem", name: "Language" });
      await tab.click({ role: "menuitemcheckbox", name: "français" });
      await tab.visible({ role: "heading", name: "Vue d'ensemble", exact: true });
      await tab.reload();
      await ctx.verify("the overview and the Lang menu read in French after a reload", [
        tab.visible({ role: "heading", name: "Vue d'ensemble", exact: true }),
        tab.visible({ role: "link", name: /^Matrice de traduction/ }),
        tab.visible({ role: "link", name: /^File de traduction/ }),
        tab.visible({ role: "link", name: /^Espaces de traduction/ }),
        tab.visible({ role: "link", name: /^Paramètres de l'espace/ }),
        tab.visible({ role: "link", name: /^Traduire 1 manquante en Français/ }),
      ]);
      for (const path of ["overview", "translations", "language?locale=fr&", "workspaces", "workspace"]) {
        const [page, query = ""] = path.split("?");
        await tab.goto(`/modules/lang/${page}?${query}workspace=${id}`);
        await ctx.verify(`${page} reads in French and shows no untranslated key`, [
          tab.visible({ role: "link", name: /^Vue d'ensemble/ }),
          tab.shows(/dms_lang\./, { not: true }),
          tab.shows(/\bOverview\b|\bTranslation matrix\b/, { not: true }),
        ]);
      }
    },
  },
  {
    id: "heatmap-tones-stay-apart-and-readable-in-dark-mode",
    title: "with the system in dark mode the dashboard turns dark, and the heatmap's green, amber and red cells keep three different colours whose figures stay readable",
    entryPoint: "/modules/lang/overview, prefers-color-scheme: dark",
    async run(/** @type {Ctx} */ ctx) {
      const id = freshId(ctx, "dark");
      /** @type {Record<string, Record<string, string>>} */
      const en = {};
      /** @type {Record<string, Record<string, string>>} */
      const fr = {};
      /** @type {[string, number][]} */
      const shares = [["n90", 9], ["n60", 6], ["n50", 5]];
      for (const [ns, translated] of shares) {
        en[ns] = {};
        fr[ns] = {};
        for (let n = 0; n < 10; n += 1) {
          en[ns][`k${n}`] = `T${n}`;
          if (n < translated) fr[ns][`k${n}`] = `F${n}`;
        }
      }
      await importTrees(ctx, id, en, fr);
      const tab = await ctx.tab("admin");
      await tab.page.emulateMedia({ colorScheme: "dark" });
      await tab.signIn("admin");
      await tab.goto(`/modules/lang/overview?workspace=${id}`);
      await tab.visible({ role: "link", name: /^n90 · Français/ });
      const dark = await tab.page.evaluate(() => document.documentElement.classList.contains("dark"));
      const cells = await Promise.all(["n90", "n60", "n50"].map((ns) => cellColours(tab, new RegExp(`^${ns} · Français`))));
      await ctx.verify("the page is dark, the three tones differ and each figure stands out from its cell", [
        ctx.equal("dark class on <html>", dark, true),
        ctx.equal("tones", await Promise.all(["n90", "n60", "n50"].map((ns) => heatTone(tab, new RegExp(`^${ns} · Français`)))), ["success", "warning", "error"]),
        ctx.equal("three different cell colours", new Set(cells.map((cell) => cell.background)).size, 3),
        ...cells.map((cell, n) => ctx.holds(`${["90%", "60%", "50%"][n]} figure contrast is at least 3:1`, cell.contrast >= 3, `${cell.contrast.toFixed(2)}:1, ${cell.text} on ${cell.background}`)),
      ]);
    },
  },
];

/**
 * The colours a heatmap cell paints, its background blended over the page's.
 *
 * @param {Tab} tab The tab on the overview
 * @param {RegExp} name The cell link's name
 * @returns {Promise<{ background: string, text: string, contrast: number }>} The opaque background, the text colour and their WCAG contrast ratio
 */
async function cellColours(tab, name) {
  return tab.page.getByRole("link", { name }).first().evaluate((/** @type {Element} */ element) => {
    const canvas = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
    /** @param {string} colour @returns {number[]} */
    const channels = (colour) => {
      if (!canvas) return [0, 0, 0, 0];
      canvas.clearRect(0, 0, 1, 1);
      canvas.fillStyle = colour;
      canvas.fillRect(0, 0, 1, 1);
      const [r = 0, g = 0, b = 0, a = 0] = canvas.getImageData(0, 0, 1, 1).data;
      return [r, g, b, a / 255];
    };
    /** @param {Element | null} node @returns {number[]} */
    const backdrop = (node) => {
      for (let current = node; current; current = current.parentElement) {
        const [r = 0, g = 0, b = 0, a = 1] = channels(getComputedStyle(current).backgroundColor);
        if (a > 0) return [r, g, b, a];
      }
      return [255, 255, 255, 1];
    };
    const [r, g, b, a] = backdrop(element);
    const [pr = 255, pg = 255, pb = 255] = a < 1 ? backdrop(element.parentElement) : [];
    const opaque = a < 1 ? [r * a + pr * (1 - a), g * a + pg * (1 - a), b * a + pb * (1 - a)] : [r, g, b];
    const figure = element.querySelector("*:not(:has(*))") ?? element;
    const [tr = 0, tg = 0, tb = 0] = channels(getComputedStyle(figure).color);
    /** @param {number[]} rgb @returns {number} */
    const luminance = (rgb) => {
      const [lr = 0, lg = 0, lb = 0] = rgb.map((value) => {
        const unit = value / 255;
        return unit <= 0.03928 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
    };
    const [light, darker] = [luminance(opaque), luminance([tr, tg, tb])].sort((x, y) => y - x);
    return {
      background: `rgb(${opaque.map(Math.round).join(", ")})`,
      text: `rgb(${tr}, ${tg}, ${tb})`,
      contrast: (light + 0.05) / (darker + 0.05),
    };
  });
}
