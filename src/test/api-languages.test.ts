import { join } from "node:path";
import { expect } from "chai";
import { failure, field, lang, objects, send, text } from "./helpers/api";
import { seed, useWorkspaceStorage } from "./helpers/api-suite";
import { readJson } from "./helpers/files";

const REQUEST_TIMEOUT_MS = 20_000;

describe("[integration] languages over the HTTP API", function () {
  this.timeout(REQUEST_TIMEOUT_MS);
  const storage = useWorkspaceStorage(true);
  const rows = async (id: string) =>
    new Map(
      objects(
        (await lang("GET", `/languages?workspace=${id}`)).body,
        "results",
      ).map((row) => [text(row, "code"), row]),
    );

  it("add-a-language: gives a language added by BCP 47 code its own file, an empty column and a native name", async () => {
    const id = "atlas";
    await seed(id, { keys: { "home.title": { en: "Home" } } });
    const add = (code: string, workspace = id) =>
      lang("POST", "/locale", { workspace, code });
    expect((await add("fr")).body).to.deep.equal({
      code: "fr",
      sameLanguage: [],
    });
    expect((await add("fr-BE")).body).to.deep.equal({
      code: "fr-BE",
      sameLanguage: ["fr"],
    });
    expect(field((await add("zh-Hant")).body, "code")).to.equal("zh-Hant");
    expect(failure(await add("fr"))).to.deep.equal([409, "locale_exists"]);
    expect(failure(await add("not a code!"))).to.deep.equal([
      400,
      "invalid_locale",
    ]);
    expect(failure(await add("fr", "nowhere"))).to.deep.equal([
      404,
      "unknown_workspace",
    ]);

    expect(storage.files(id)).to.deep.equal([
      ".workspace.json",
      "en.json",
      "fr-BE.json",
      "fr.json",
      "zh-Hant.json",
    ]);
    const languages = await rows(id);
    expect(languages.get("fr")?.name).to.equal("Français");
    expect(languages.get("fr-BE")?.name).to.equal("Français (Belgique)");
    expect([
      languages.get("en")?.isBase,
      languages.get("fr")?.isBase,
    ]).to.deep.equal([true, false]);
    const french = languages.get("fr");
    expect([
      french?.translated,
      french?.total,
      french?.missing,
      french?.coverage,
    ]).to.deep.equal([0, 1, 1, 0]);
    expect(languages.get("en")?.coverage).to.equal(100);
  });

  it("remove-a-language: deletes the file and the public URL of a language and refuses to remove the base", async () => {
    const id = "removal";
    await seed(id, {
      locales: ["en", "fr", "de"],
      keys: { "home.title": { en: "Home", fr: "Accueil", de: "Start" } },
    });
    const base = text((await lang("GET", "/workspaces")).body, "publicBaseUrl");
    const confirm = await lang("GET", `/languages/${id}/fr/removal-confirm`);
    expect(confirm.status).to.equal(200);
    expect(field(confirm.body, "params", "file")).to.equal("fr.json");
    expect(field(confirm.body, "params", "url")).to.equal(
      `${base}/${id}/fr.json`,
    );

    const removed = await lang("DELETE", `/languages/${id}/fr`);
    expect(removed.status).to.equal(200);
    expect(storage.files(id)).to.deep.equal([
      ".workspace.json",
      "de.json",
      "en.json",
    ]);
    expect(failure(await lang("DELETE", `/languages/${id}/en`))).to.deep.equal([
      409,
      "base_locale",
    ]);
    expect((await lang("DELETE", `/languages/${id}/it`)).status).to.equal(404);
    expect(readJson(join(storage.folder(id), "de.json"))).to.deep.equal({
      home: { title: "Start" },
    });
    expect((await send(`/i18n/${id}/fr.json`)).status).to.equal(404);
    expect((await send(`/i18n/${id}/de.json`)).status).to.equal(200);
  });

  it("make-a-language-the-base: measures every coverage against the new base and refuses an unknown language", async () => {
    const id = "rebased";
    await seed(id, {
      locales: ["en", "fr"],
      keys: {
        "a.one": { en: "One", fr: "Un" },
        "a.two": { en: "Two" },
        "a.three": { fr: "Trois" },
      },
    });
    const before = await lang("GET", `/flat?workspace=${id}`);
    const confirm = await lang("GET", `/languages/${id}/fr/base-confirm`);
    const made = await lang("POST", `/languages/${id}/fr/base`);
    const after = await lang("GET", `/flat?workspace=${id}`);
    const languages = await rows(id);
    expect(field(before.body, "defaultLocale")).to.equal("en");
    expect(field(before.body, "baseMissing")).to.equal(1);
    expect(field(confirm.body, "missing")).to.equal(1);
    expect(made.status).to.equal(200);
    expect(made.body).to.deep.equal({ defaultLocale: "fr" });
    expect(field(after.body, "defaultLocale")).to.equal("fr");
    expect(field(after.body, "baseMissing")).to.equal(1);
    expect([
      languages.get("en")?.isBase,
      languages.get("fr")?.isBase,
    ]).to.deep.equal([false, true]);
    expect(languages.get("en")?.missing).to.equal(1);
    expect(
      (await lang("POST", `/languages/${id}/it/base`)).status,
    ).to.be.at.least(400);
  });
});

describe("[integration] language confirmations and app snippets over the HTTP API", function () {
  this.timeout(REQUEST_TIMEOUT_MS);
  useWorkspaceStorage(true);

  it("removing-an-empty-language-asks-for-no-code: asks no code and offers no download for a language with no text, and does for one with a text", async () => {
    await seed("emptyl", {
      locales: ["en", "fr", "de"],
      keys: { "a.b": { en: "Hello", fr: "Salut" } },
    });
    const empty = await lang("GET", "/languages/emptyl/de/removal-confirm");
    const full = await lang("GET", "/languages/emptyl/fr/removal-confirm");
    expect(field(empty.body, "confirmText")).to.equal(undefined);
    expect(field(empty.body, "secondaryAction")).to.equal(undefined);
    expect(field(full.body, "confirmText")).to.equal("fr");
    expect(field(full.body, "secondaryAction")).to.not.equal(undefined);
  });

  it("base-confirm-lists-twenty-keys-and-shows-five: lists at most 20 of the keys a new base lacks and shows 5 with a count of the rest", async () => {
    const lacking = Array.from(
      { length: 25 },
      (_, n): [string, Record<string, string>] => [
        `a.k${String(n).padStart(2, "0")}`,
        { en: `T${n}` },
      ],
    );
    await seed("limits", {
      locales: ["en", "fr"],
      keys: Object.fromEntries(lacking),
    });
    const answer = await lang("GET", "/languages/limits/fr/base-confirm");
    const impact = objects(answer.body, "impact");
    expect(field(answer.body, "missing")).to.equal(25);
    expect(
      JSON.stringify(field(answer.body, "keys")).split(","),
    ).to.have.length(20);
    expect(impact).to.have.length(6);
    expect(impact.at(-1)?.count).to.equal(20);
  });

  it("i18next-lists-the-bare-language: lists the language of each region in supportedLngs, which i18next needs to accept the region", async () => {
    await seed("regions", { locales: ["en", "pt-BR"] });
    const answer = await lang("GET", "/snippet?workspace=regions&kind=i18next");
    const line = /supportedLngs: (\[[^\]]*\])/.exec(text(answer.body, "code"));
    expect(JSON.parse(line?.[1] ?? "[]")).to.deep.equal(["en", "pt", "pt-BR"]);
  });

  it("fetch-snippet-loads-the-base-first: merges the base, then the language, then the region, so the region wins over the base", async () => {
    await seed("fetched", { locales: ["en", "fr"] });
    const answer = await lang("GET", "/snippet?workspace=fetched&kind=fetch");
    const code = text(answer.body, "code");
    expect(code).to.include(
      'const codes = [...new Set([base, locale.split("-")[0], locale])];',
    );
    expect(code).to.include("files.reduce(merge, {})");
  });
});
