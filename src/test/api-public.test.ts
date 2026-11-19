import { expect } from "chai";
import { type Answer, lang, send } from "./helpers/api";
import { seed, useWorkspaceStorage } from "./helpers/api-suite";

const REQUEST_TIMEOUT_MS = 20_000;
const FOREIGN_ORIGIN = "https://shop.example.org";

/** A storefront with two keys: French lacks one. */
function checkoutWorkspace(id: string): Promise<Answer> {
  return seed(id, {
    locales: ["en", "fr"],
    keys: {
      "checkout.pay": { en: "Pay now", fr: "Payer maintenant" },
      "checkout.cancel": { en: "Cancel order" },
    },
  });
}

describe("[integration] the public translation files over HTTP", function () {
  this.timeout(REQUEST_TIMEOUT_MS);
  useWorkspaceStorage(true);

  it("serves-the-nested-tree: serves a language as its nested tree without the keys it has no text for, and an edit shows on the next read", async () => {
    await checkoutWorkspace("storefront");
    const french = await send("/i18n/storefront/fr.json");
    expect(french.status).to.equal(200);
    expect(french.body).to.deep.equal({
      checkout: { pay: "Payer maintenant" },
    });
    expect(french.headers.get("content-type")).to.match(/^application\/json/);
    expect(french.headers.get("content-language")).to.equal("fr");
    expect((await send("/i18n/storefront/en.json")).body).to.deep.equal({
      checkout: { pay: "Pay now", cancel: "Cancel order" },
    });
    await lang("PUT", "/key", {
      workspace: "storefront",
      path: "checkout.pay",
      values: { fr: "Régler" },
    });
    expect((await send("/i18n/storefront/fr.json")).body).to.deep.equal({
      checkout: { pay: "Régler" },
    });
  });

  it("no-cache-and-no-credentials: asks clients to revalidate and opens the file to any origin without credentials", async () => {
    await checkoutWorkspace("storefront-cors");
    const path = "/i18n/storefront-cors/fr.json";
    const read = await send(path, { headers: { origin: FOREIGN_ORIGIN } });
    expect(read.headers.get("cache-control")).to.equal("no-cache");
    expect(read.headers.get("access-control-allow-origin")).to.equal("*");
    expect(read.headers.get("access-control-allow-credentials")).to.equal(null);
    const preflight = await send(path, {
      method: "OPTIONS",
      headers: {
        origin: FOREIGN_ORIGIN,
        "access-control-request-method": "GET",
      },
    });
    expect(preflight.status).to.equal(204);
    expect(preflight.headers.get("access-control-allow-origin")).to.equal("*");
    expect(preflight.headers.get("access-control-allow-methods")).to.equal(
      "GET,HEAD,OPTIONS",
    );
  });

  it("unknown-workspace-or-locale-is-404: answers 404 for a missing workspace or language, not for a valid language with no texts yet", async () => {
    await seed("storefront-empty", { locales: ["en", "fr"] });
    expect((await send("/i18n/nowhere/fr.json")).status).to.equal(404);
    expect((await send("/i18n/storefront-empty/de.json")).status).to.equal(404);
    const empty = await send("/i18n/storefront-empty/fr.json");
    expect([empty.status, empty.body]).to.deep.equal([200, {}]);
  });

  it("private-workspaces-are-not-public: never serves the project files or the installed modules", async () => {
    for (const id of ["default", "modules"])
      expect((await send(`/i18n/${id}/en.json`)).status, id).to.equal(404);
  });

  it("workspace-ids-are-case-insensitive: reads the same file for a workspace id in capitals", async () => {
    await checkoutWorkspace("storefront-case");
    const answer = await send("/i18n/STOREFRONT-CASE/fr.json");
    expect([answer.status, answer.body]).to.deep.equal([
      200,
      { checkout: { pay: "Payer maintenant" } },
    ]);
  });

  it("a-region-without-a-file-is-served-its-language: serves the fr file with Content-Language fr for fr-BE when the workspace has no fr-BE", async () => {
    await seed("region", {
      locales: ["en", "fr"],
      keys: { "a.b": { en: "x", fr: "y" } },
    });
    const served = await send("/i18n/region/fr-BE.json");
    expect(served.status).to.equal(200);
    expect(served.body).to.deep.equal({ a: { b: "y" } });
    expect(served.headers.get("content-language")).to.equal("fr");
  });
});
