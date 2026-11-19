import { once } from "node:events";
import { createServer } from "node:http";
import { roundNinePublic } from "./parts/round9.mjs";
import { freshId, guarded, lang, parseJson, pick, raw, recordRaw, seedWorkspace } from "../lang.mjs";

/** @typedef {import("../lang.mjs").Ctx} Ctx */

/**
 * @param {Ctx} ctx The journey
 * @param {string} id The workspace
 */
async function checkoutWorkspace(ctx, id) {
  await seedWorkspace(ctx, id, {
    locales: ["en", "fr"],
    keys: { "checkout.pay": { en: "Pay now", fr: "Payer maintenant" }, "checkout.cancel": { en: "Cancel order" } },
  });
}

/** The translation files of the created workspaces, served to any app. */
export const journeys = guarded([
  {
    id: "serves-the-nested-tree",
    tag: "@smoke",
    title: "a translated message is served as the language's nested tree, without the keys it has no text for, on both origins",
    entryPoint: "GET /i18n/<workspace>/<locale>.json",
    async run(/** @type {Ctx} */ ctx) {
      const id = freshId(ctx, "storefront");
      await checkoutWorkspace(ctx, id);
      const french = await raw(ctx, "read the French file from the backend", { path: `/i18n/${id}/fr.json` });
      recordRaw(ctx, french, [
        ctx.equal("HTTP status", french.status, 200),
        ctx.equal("only the translated key", french.json, { checkout: { pay: "Payer maintenant" } }),
        ctx.holds("served as JSON", (french.headers["content-type"] ?? "").startsWith("application/json"), french.headers["content-type"]),
        ctx.equal("Content-Language", french.headers["content-language"], "fr"),
      ]);
      const english = await raw(ctx, "read the base language file", { path: `/i18n/${id}/en.json` });
      recordRaw(ctx, english, [
        ctx.equal("the base language holds every key", english.json, { checkout: { pay: "Pay now", cancel: "Cancel order" } }),
      ]);
      const web = await raw(ctx, "read the French file through the dashboard origin", { path: `/i18n/${id}/fr.json`, origin: "web" });
      recordRaw(ctx, web, [
        ctx.equal("HTTP status", web.status, 200),
        ctx.equal("the same tree", web.json, { checkout: { pay: "Payer maintenant" } }),
      ]);
      await lang(ctx, "retranslate the key", "PUT", "/key", { workspace: id, path: "checkout.pay", values: { fr: "Régler" } });
      const again = await raw(ctx, "read the French file after the edit", { path: `/i18n/${id}/fr.json` });
      recordRaw(ctx, again, [ctx.equal("the edit shows on the next read", again.json, { checkout: { pay: "Régler" } })]);
    },
  },
  {
    id: "no-cache-and-no-credentials",
    title: "the public file asks clients to revalidate and is open to any origin without credentials",
    entryPoint: "GET /i18n/<workspace>/<locale>.json with an Origin header",
    async run(/** @type {Ctx} */ ctx) {
      const id = freshId(ctx, "storefront");
      await checkoutWorkspace(ctx, id);
      const read = await raw(ctx, "read the file from a foreign origin", { path: `/i18n/${id}/fr.json`, headers: { origin: "https://shop.example.org" } });
      recordRaw(ctx, read, [
        ctx.equal("Cache-Control", read.headers["cache-control"], "no-cache"),
        ctx.equal("Access-Control-Allow-Origin", read.headers["access-control-allow-origin"], "*"),
        ctx.equal("no credentials header", read.headers["access-control-allow-credentials"], undefined),
      ]);
      const preflight = await raw(ctx, "preflight from a foreign origin", {
        path: `/i18n/${id}/fr.json`,
        method: "OPTIONS",
        headers: { origin: "https://shop.example.org", "access-control-request-method": "GET" },
      });
      recordRaw(ctx, preflight, [
        ctx.equal("HTTP status", preflight.status, 204),
        ctx.equal("Access-Control-Allow-Origin", preflight.headers["access-control-allow-origin"], "*"),
        ctx.equal("Access-Control-Allow-Methods", preflight.headers["access-control-allow-methods"], "GET,HEAD,OPTIONS"),
      ]);
    },
  },
  {
    id: "unknown-workspace-or-locale-is-404",
    title: "a missing workspace or language answers 404, which a valid language with no texts yet does not",
    entryPoint: "GET /i18n/<workspace>/<locale>.json",
    async run(/** @type {Ctx} */ ctx) {
      const id = freshId(ctx, "storefront");
      await seedWorkspace(ctx, id, { locales: ["en", "fr"] });
      const noWorkspace = await raw(ctx, "read a workspace that does not exist", { path: `/i18n/${freshId(ctx, "nowhere")}/fr.json` });
      const noLocale = await raw(ctx, "read a language the workspace does not have", { path: `/i18n/${id}/de.json` });
      const empty = await raw(ctx, "read a language with no text", { path: `/i18n/${id}/fr.json` });
      recordRaw(ctx, noWorkspace, [ctx.equal("HTTP status", noWorkspace.status, 404)]);
      recordRaw(ctx, noLocale, [ctx.equal("HTTP status", noLocale.status, 404)]);
      recordRaw(ctx, empty, [ctx.equal("HTTP status", empty.status, 200), ctx.equal("an empty tree", empty.json, {})]);
    },
  },
  {
    id: "private-workspaces-are-not-public",
    title: "the project files and the installed modules are never served at /i18n",
    entryPoint: "GET /i18n/default/en.json and /i18n/modules/en.json",
    async run(/** @type {Ctx} */ ctx) {
      for (const id of ["default", "modules"]) {
        const answer = await raw(ctx, `read the ${id} workspace`, { path: `/i18n/${id}/en.json` });
        recordRaw(ctx, answer, [ctx.equal("HTTP status", answer.status, 404)]);
      }
    },
  },
  {
    id: "workspace-ids-are-case-insensitive",
    title: "a workspace id in capitals reads the same file",
    entryPoint: "GET /i18n/<WORKSPACE>/<locale>.json",
    async run(/** @type {Ctx} */ ctx) {
      const id = freshId(ctx, "storefront");
      await checkoutWorkspace(ctx, id);
      const answer = await raw(ctx, "read with a capitalised id", { path: `/i18n/${id.toUpperCase()}/fr.json` });
      recordRaw(ctx, answer, [
        ctx.equal("HTTP status", answer.status, 200),
        ctx.equal("the same tree", answer.json, { checkout: { pay: "Payer maintenant" } }),
      ]);
    },
  },
  {
    id: "another-app-loads-the-workspace-with-the-fetch-setup",
    title: "a page of another app, on its own origin and signed in nowhere, runs the fetch setup of the settings page and gets the language's texts over the base",
    entryPoint: "Workspace settings > Use in your app > Fetch, run in a browser page of another origin",
    async run(/** @type {Ctx} */ ctx) {
      const id = freshId(ctx, "elsewhere");
      await checkoutWorkspace(ctx, id);
      const snippet = await lang(ctx, "read the fetch setup", "GET", `/snippet?workspace=${id}&kind=fetch`);
      const code = String(pick(snippet.body, "code")).replace("const messages = await loadMessages();", "");
      const shop = createServer((_request, response) => {
        response.writeHead(200, { "content-type": "text/html" });
        response.end("<!doctype html><title>Shop</title><h1>Shop</h1>");
      }).listen(0, "127.0.0.1");
      await once(shop, "listening");
      try {
        const app = `http://127.0.0.1:${Number(pick(shop.address(), "port"))}`;
        const tab = await ctx.tab("anon", "another app");
        await tab.page.goto(`${app}/`);
        const loaded = parseJson(String(await tab.page.evaluate(`(async () => {\n${code}\nreturn JSON.stringify(await loadMessages("fr"));\n})()`).catch((/** @type {unknown} */ error) => JSON.stringify(String(error)))));
        await ctx.verify("the browser lets the other origin read the files, and the French text wins over the English one", [
          ctx.holds("the page is on another origin than the files", !code.includes(app), app),
          ctx.equal("messages", loaded, { checkout: { pay: "Payer maintenant", cancel: "Cancel order" } }),
        ]);
      } finally {
        shop.close();
      }
    },
  },
  ...roundNinePublic,
]);
