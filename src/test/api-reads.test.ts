import { expect } from "chai";
import { field, lang, objects, send, text } from "./helpers/api";
import { seed, useWorkspaceStorage } from "./helpers/api-suite";
import type { JsonValue } from "../utils/json";

const REQUEST_TIMEOUT_MS = 20_000;
const PERMISSION_NAMES = [
  "createWorkspace",
  "deleteWorkspace",
  "editTranslations",
  "editWorkspace",
  "manageKeys",
  "manageLanguages",
  "renameWorkspace",
];

function itemIds(body: JsonValue): JsonValue[] {
  return objects(body, "items").map((item) => item.id);
}

describe("[integration] read routes over the HTTP API", function () {
  this.timeout(REQUEST_TIMEOUT_MS);
  useWorkspaceStorage(true);

  it("read-routes-carry-what-the-docs-name: gives the workspaces, summary, figures, progress, About card, endpoint and languages table the extending page names", async () => {
    const id = "reads";
    await seed(id, {
      locales: ["en", "fr"],
      keys: { "a.one": { en: "One", fr: "Un" }, "a.two": { en: "Two" } },
    });
    const workspaces = await lang("GET", "/workspaces");
    const summary = await lang("GET", "/summary");
    const kpis = await lang("GET", `/kpis?workspace=${id}`);
    const stats = await lang("GET", `/locale-stats?workspace=${id}&locale=fr`);
    const about = await lang("GET", `/about?workspace=${id}`);
    const endpoint = await lang("GET", `/endpoint?workspace=${id}`);
    const languages = await lang("GET", `/languages?workspace=${id}`);

    expect(field(workspaces.body, "editable")).to.equal(true);
    expect(text(workspaces.body, "publicBaseUrl")).to.match(/\/i18n$/);
    const permissions = field(workspaces.body, "permissions");
    expect(Object.keys(permissions ?? {}).sort()).to.deep.equal(
      PERMISSION_NAMES,
    );
    expect(
      new Set(objects(workspaces.body, "workspaces").map((w) => w.kind)),
    ).to.deep.equal(new Set(["default", "added", "modules"]));

    const mine = objects(summary.body, "workspaces").find((w) => w.id === id);
    expect([
      mine?.totalKeys,
      mine?.translatedStrings,
      mine?.missing,
      mine?.coverage,
      mine?.baseLocale,
      objects(mine, "locales").length,
    ]).to.deep.equal([2, 3, 1, 50, "en", 2]);

    expect(itemIds(kpis.body)).to.deep.equal([
      "languages",
      "keys",
      "missing",
      "coverage",
    ]);
    expect(itemIds(stats.body)).to.deep.equal([
      "coverage",
      "translated",
      "missing",
      "issues",
    ]);
    expect(itemIds(about.body)).to.deep.equal([
      "kind",
      "editable",
      "keys",
      "strings",
      "folder",
    ]);
    expect(itemIds(endpoint.body)).to.deep.equal([
      "url",
      "example",
      "fallback",
      "access",
    ]);
    expect(
      objects(endpoint.body, "items").some((item) =>
        text(item, "value").endsWith(`/i18n/${id}/{locale}.json`),
      ),
    ).to.equal(true);
    expect(
      objects(languages.body, "results").map((row) => [
        row.code,
        row.isBase,
        row.translated,
        row.total,
      ]),
    ).to.deep.equal([
      ["en", true, 2, 2],
      ["fr", false, 1, 2],
    ]);
  });
});

describe("[integration] read errors and rankings over the HTTP API", function () {
  this.timeout(REQUEST_TIMEOUT_MS);
  useWorkspaceStorage(true);

  it("errors-carry-a-message-key-and-a-code: answers 404 unknown_workspace with a message key on every read route, and the public 404 names the workspace and the locale", async () => {
    const id = "errors";
    await seed(id, { keys: { "a.b": { en: "Hello" } } });
    for (const path of [
      "flat",
      "workspace",
      "namespaces",
      "languages",
      "kpis",
      "about",
      "endpoint",
      "export",
      "backup",
    ]) {
      const answer = await lang("GET", `/${path}?workspace=nope-${id}`);
      expect(
        [
          answer.status,
          field(answer.body, "code"),
          field(answer.body, "message"),
        ],
        path,
      ).to.deep.equal([
        404,
        "unknown_workspace",
        "$dms_lang.errors.unknown_workspace",
      ]);
    }
    const omitted = await lang("GET", "/flat");
    expect(omitted.status).to.equal(200);
    expect(field(omitted.body, "rows")).to.be.an("array");

    const missing = await send(`/i18n/${id}/de.json`);
    expect(missing.status).to.equal(404);
    expect(missing.body).to.deep.equal({
      workspace: id,
      locale: "de",
      message: "$dms_lang.errors.unknown_locale",
      code: "unknown_locale",
    });
  });

  it("namespaces-rank-by-share-of-missing-texts: lists the namespace with the largest share of missing texts first, not the one with the most", async () => {
    const big = Array.from(
      { length: 10 },
      (_, n): [string, Record<string, string>] => [
        `big.k${n}`,
        n < 2 ? { en: `Text ${n}` } : { en: `Text ${n}`, fr: `Texte ${n}` },
      ],
    );
    const keys = { "small.only": { en: "Only" }, ...Object.fromEntries(big) };
    await seed("ranks", { locales: ["en", "fr"], keys });
    const coverage = await lang("GET", "/namespaces?workspace=ranks");
    expect(
      objects(coverage.body, "namespaces").map((row) => row.namespace),
    ).to.deep.equal(["small", "big"]);
  });
});
