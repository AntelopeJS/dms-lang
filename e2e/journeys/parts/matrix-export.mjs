import { downloadOf } from "../../files.mjs";
import { clickUntil, freshId, seedWorkspace } from "../../lang.mjs";

/** @typedef {import("../../lang.mjs").Ctx} Ctx */

/**
 * Reads a CSV of quoted cells, as the matrix export writes it: CRLF between lines, `""` for a quote inside a cell.
 *
 * @param {string} text The file, with or without its byte order mark
 * @returns {string[][]} One array of cells per line
 */
function csvTable(text) {
  return text
    .replace(/^\uFEFF/, "")
    .split("\r\n")
    .filter((line) => line !== "")
    .map((line) => [...line.matchAll(/"((?:[^"]|"")*)"/g)].map((match) => (match[1] ?? "").replaceAll('""', '"')));
}

/** The CSV the matrix builds in the browser and saves. */
export const exportJourneys = [
  {
    id: "export-downloads-the-csv",
    title: "Export saves a CSV with the key and one column per language, formulas kept as text, CRLF lines and a byte order mark; a filtered view saves its own file",
    entryPoint: "/modules/lang/translations > Export > Everything",
    async run(/** @type {Ctx} */ ctx) {
      const id = freshId(ctx, "csv");
      await seedWorkspace(ctx, id, {
        locales: ["en", "fr", "de"],
        keys: {
          "shop.title": { en: "Shop", fr: "Boutique", de: "Laden" },
          "shop.formula": { en: "=1+1", fr: "-cmd", de: "+49" },
          "shop.quote": { en: 'Say "hi"', fr: "Dis, \"salut\"" },
        },
      });
      const tab = await ctx.tab("admin");
      await tab.signIn("admin");
      await tab.goto(`/modules/lang/translations?workspace=${id}`);
      await clickUntil(tab, { role: "button", name: "Export" }, { role: "menuitem", name: "Everything · 3 keys, 3 languages" });
      const everything = await downloadOf(ctx, tab, { role: "menuitem", name: "Everything · 3 keys, 3 languages" });
      const text = everything?.text ?? "";
      await ctx.verify("the whole workspace is one file named after it", [ctx.equal("file name", everything?.name, `${id}-all.csv`)]);
      const table = csvTable(text);
      const header = table[0] ?? [];
      /** @param {string} key The row's key @param {string} code The language @returns {string | undefined} The cell */
      const cell = (key, code) => table.find((row) => row[0] === key)?.[header.indexOf(code)];
      await ctx.verify("the file starts with a byte order mark and a header of the key and one column per language, the base first", [
        ctx.holds("byte order mark", text.startsWith("\uFEFF"), JSON.stringify(text.slice(0, 12))),
        ctx.equal("header", [header[0], header[1], header.slice(2).sort(), header.length], ["key", "en", ["de", "fr"], 4]),
      ]);
      await ctx.verify("every line ends with CRLF, one line per key", [
        ctx.holds("no bare line feed", !/[^\r]\n/.test(text), JSON.stringify(text)),
        ctx.holds("ends with CRLF", text.endsWith("\r\n"), JSON.stringify(text.slice(-12))),
        ctx.equal("lines", table.length, 4),
        ctx.equal("every row has a cell per column", table.every((row) => row.length === 4), true),
      ]);
      await ctx.verify("each cell holds its language's text, with quotes doubled", [
        ctx.equal("shop.title", [cell("shop.title", "en"), cell("shop.title", "fr"), cell("shop.title", "de")], ["Shop", "Boutique", "Laden"]),
        ctx.equal("shop.quote", [cell("shop.quote", "en"), cell("shop.quote", "fr")], ['Say "hi"', 'Dis, "salut"']),
      ]);
      await ctx.verify("a text that looks like a formula is kept as text", [
        ctx.equal("= - and + are prefixed", [cell("shop.formula", "en"), cell("shop.formula", "fr"), cell("shop.formula", "de")], ["'=1+1", "'-cmd", "'+49"]),
      ]);
      await tab.goto(`/modules/lang/translations?workspace=${id}`);
      await clickUntil(tab, { role: "button", name: "Export" }, { role: "menuitem", name: "This view · 3 keys, 3 languages" });
      const view = await downloadOf(ctx, tab, { role: "menuitem", name: "This view · 3 keys, 3 languages" });
      await ctx.verify("the view is a file of its own, with the same header", [
        ctx.holds("file name", view !== null && view.name.startsWith(`${id}-view-`) && view.name.endsWith(".csv"), String(view?.name)),
        ctx.holds("header", (view?.text ?? "").startsWith('\uFEFF"key","en"'), JSON.stringify((view?.text ?? "").slice(0, 30))),
      ]);
    },
  },
];
