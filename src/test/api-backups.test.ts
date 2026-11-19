import { expect } from "chai";
import type { JsonObject } from "../utils/json";
import {
  failure,
  field,
  lang,
  objectOf,
  objects,
  send,
  text,
} from "./helpers/api";
import { seed, useWorkspaceStorage } from "./helpers/api-suite";

const REQUEST_TIMEOUT_MS = 20_000;
const BACKUP_FORMAT = "dms-lang.workspace";

/** A shop workspace with a base, a language, two keys, a description and a type. */
async function shopWorkspace(id: string): Promise<void> {
  await lang("POST", "/workspace", {
    id,
    locale: { code: "en" },
    description: "Shop texts",
    type: "website",
  });
  await lang("POST", "/locale", { workspace: id, code: "fr" });
  await lang("POST", "/key", {
    workspace: id,
    path: "checkout.pay",
    values: { en: "Pay {price}", fr: "Payer {price}" },
  });
  await lang("POST", "/key", {
    workspace: id,
    path: "checkout.cancel",
    values: { en: "Cancel" },
  });
}

describe("[integration] backup and import over the HTTP API", function () {
  this.timeout(REQUEST_TIMEOUT_MS);
  const storage = useWorkspaceStorage(true);

  it("backup-restores-the-workspace: restores the deleted workspace with its languages, details and texts, or a copy under another name", async () => {
    await shopWorkspace("shop");
    const backup = await lang("GET", "/backup?workspace=shop");
    expect(backup.status).to.equal(200);
    expect(backup.body).to.deep.equal({
      format: BACKUP_FORMAT,
      version: 1,
      id: "shop",
      defaultLocale: "en",
      locales: [{ code: "en" }, { code: "fr" }],
      description: "Shop texts",
      type: "website",
      messages: {
        en: { checkout: { pay: "Pay {price}", cancel: "Cancel" } },
        fr: { checkout: { pay: "Payer {price}" } },
      },
    });
    const before = await lang("GET", "/flat?workspace=shop");
    await lang("DELETE", "/workspace", { id: "shop" });
    const restored = await lang("POST", "/import", backup.body);
    expect(restored.status).to.equal(200);
    expect(restored.body).to.deep.equal({
      id: "shop",
      kind: "added",
      editable: true,
      defaultLocale: "en",
      locales: [{ code: "en" }, { code: "fr" }],
      description: "Shop texts",
      type: "website",
    });
    expect((await lang("GET", "/flat?workspace=shop")).body).to.deep.equal(
      before.body,
    );
    expect(storage.files("shop")).to.deep.equal([
      ".workspace.json",
      "en.json",
      "fr.json",
    ]);
    expect((await send("/i18n/shop/fr.json")).body).to.deep.equal({
      checkout: { pay: "Payer {price}" },
    });

    const copy = await lang("POST", "/import", {
      ...objectOf(backup.body),
      id: "shop-copy",
    });
    expect(copy.status).to.equal(200);
    const copied = await lang("GET", "/flat?workspace=shop-copy");
    expect(field(copied.body, "rows")).to.deep.equal(
      field(before.body, "rows"),
    );
  });

  it("backup-refusals: creates nothing from another format, a newer version, a taken or reserved name or a broken message", async () => {
    await shopWorkspace("refused");
    const backup = objectOf(
      (await lang("GET", "/backup?workspace=refused")).body,
    );
    const cases: [string, string, JsonObject, number, string][] = [
      ["a taken name", "refused", {}, 409, "workspace_exists"],
      ["a reserved name", "default", {}, 400, "reserved_workspace"],
      ["another format", "format-a", { format: "other" }, 400, "invalid_body"],
      ["a newer version", "version-b", { version: 2 }, 400, "invalid_body"],
      [
        "a text that is not a string",
        "text-c",
        { messages: { en: { a: 5 } } },
        400,
        "invalid_value",
      ],
      [
        "a message vue-i18n cannot compile",
        "syntax-d",
        { messages: { en: { a: "jane@example.com" } } },
        400,
        "invalid_message",
      ],
      [
        "texts of a language the backup does not declare",
        "locale-e",
        { messages: { en: { a: "x" }, de: { a: "y" } } },
        400,
        "undeclared_locale",
      ],
    ];
    for (const [label, id, change, status, code] of cases) {
      const answer = await lang("POST", "/import", {
        ...backup,
        ...change,
        id,
      });
      expect(failure(answer), label).to.deep.equal([status, code]);
      if (id === "refused" || id === "default") continue;
      const absent = await lang("GET", `/workspace?workspace=${id}`);
      expect(absent.status, `${label} created no workspace`).to.equal(404);
      expect(storage.files(id), label).to.deep.equal([]);
    }
    const newer = await lang("POST", "/import", {
      ...backup,
      id: "version-f",
      version: 2,
    });
    expect(JSON.stringify(newer.body)).to.include("newer_backup");
  });
});

describe("[integration] export and empty backups over the HTTP API", function () {
  this.timeout(REQUEST_TIMEOUT_MS);
  const storage = useWorkspaceStorage(true);

  it("export-one-language-or-all: exports one language's tree or every language, and an unknown language is a 404", async () => {
    await shopWorkspace("exported");
    const french = await lang("GET", "/export?workspace=exported&locale=fr");
    const everything = await lang("GET", "/export?workspace=exported");
    const german = await lang("GET", "/export?workspace=exported&locale=de");
    expect(french.body).to.deep.equal({ checkout: { pay: "Payer {price}" } });
    expect(everything.body).to.deep.equal({
      en: { checkout: { pay: "Pay {price}", cancel: "Cancel" } },
      fr: { checkout: { pay: "Payer {price}" } },
    });
    expect(failure(german)).to.deep.equal([404, "unknown_locale"]);
  });

  it("empty-workspace-roundtrip: exports empty trees, backs up and restores a workspace without keys with its languages", async () => {
    await seed("hollow", { locales: ["en", "fr"] });
    const exported = await lang("GET", "/export?workspace=hollow");
    const backup = await lang("GET", "/backup?workspace=hollow");
    expect(exported.body).to.deep.equal({ en: {}, fr: {} });
    expect(field(backup.body, "messages")).to.deep.equal({ en: {}, fr: {} });
    await lang("DELETE", "/workspace", { id: "hollow" });
    const restored = await lang("POST", "/import", backup.body);
    expect(
      objects(restored.body, "locales").map((entry) => entry.code),
    ).to.deep.equal(["en", "fr"]);
    expect(storage.files("hollow")).to.deep.equal([
      ".workspace.json",
      "en.json",
      "fr.json",
    ]);
    const minimal = await lang("POST", "/import", {
      id: "minimal",
      messages: { en: {} },
    });
    expect(minimal.status).to.equal(200);
    expect(text(minimal.body, "defaultLocale")).to.equal("en");
  });
});
