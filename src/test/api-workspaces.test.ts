import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect } from "chai";
import { failure, field, lang, objects, send, text } from "./helpers/api";
import { seed, useWorkspaceStorage } from "./helpers/api-suite";
import type { JsonValue } from "../utils/json";
import { readJson, readText } from "./helpers/files";

const REQUEST_TIMEOUT_MS = 20_000;

describe("[integration] workspace names and details over the HTTP API", function () {
  this.timeout(REQUEST_TIMEOUT_MS);
  const storage = useWorkspaceStorage(true);

  it("create-and-list: lists a created workspace with its languages, details and public URL, and stores its files", async () => {
    const id = "partner";
    const created = await lang("POST", "/workspace", {
      id,
      locale: { code: "en" },
      description: "Texts of the partner app",
      type: "mobile",
    });
    expect(created.status).to.equal(200);
    expect(created.body).to.deep.equal({
      id,
      kind: "added",
      editable: true,
      defaultLocale: "en",
      locales: [{ code: "en" }],
      description: "Texts of the partner app",
      type: "mobile",
    });

    const listed = await lang("GET", "/workspaces");
    const all = objects(listed.body, "workspaces");
    const entry = all.find((workspace) => workspace.id === id);
    expect(
      all
        .filter(
          (workspace) => workspace.kind !== "added" || workspace.id === id,
        )
        .map((workspace) => workspace.kind),
      "project files first, modules last",
    ).to.deep.equal(["default", "added", "modules"]);
    expect(entry?.publicUrl).to.equal(
      `${text(listed.body, "publicBaseUrl")}/${id}/{locale}.json`,
    );
    expect(all.find((w) => w.id === "default")?.publicUrl).to.equal(undefined);
    expect(all.find((w) => w.id === "modules")?.editable).to.equal(false);
    expect(field(listed.body, "editable")).to.equal(true);

    expect(storage.files(id)).to.deep.equal([".workspace.json", "en.json"]);
    expect(readJson(join(storage.folder(id), "en.json"))).to.deep.equal({});

    const edited = await lang("PATCH", "/workspace", {
      id,
      description: null,
      type: "",
    });
    expect(edited.status).to.equal(200);
    expect(edited.body).to.deep.equal({
      id,
      kind: "added",
      editable: true,
      defaultLocale: "en",
      locales: [{ code: "en" }],
    });
    const badType = await lang("PATCH", "/workspace", { id, type: "desktop" });
    expect(failure(badType)).to.deep.equal([400, "invalid_body"]);
  });

  it("name-rules: takes lowercase letters, digits, dashes and underscores and refuses reserved and taken names", async () => {
    for (const bad of [
      "two words",
      "with/slash",
      "..",
      "émoji",
      "x.x",
      "v1.2-beta",
    ]) {
      const answer = await lang("POST", "/workspace", {
        id: bad,
        locale: { code: "en" },
      });
      expect(failure(answer), bad).to.deep.equal([400, "invalid_workspace_id"]);
    }
    for (const reserved of ["default", "modules"]) {
      const answer = await lang("POST", "/workspace", {
        id: reserved,
        locale: { code: "en" },
      });
      expect(failure(answer), reserved).to.deep.equal([
        400,
        "reserved_workspace",
      ]);
    }
    const created = await lang("POST", "/workspace", {
      id: "Rules_A-1",
      locale: { code: "en" },
    });
    expect(created.status).to.equal(200);
    expect(field(created.body, "id")).to.equal("rules_a-1");
    const again = await lang("POST", "/workspace", {
      id: "RULES_A-1",
      locale: { code: "en" },
    });
    expect(failure(again)).to.deep.equal([409, "workspace_exists"]);
    const noLocale = await lang("POST", "/workspace", {
      id: "rules-b",
      locale: { code: "" },
    });
    expect(noLocale.status).to.equal(400);
  });
});

describe("[integration] renaming and deleting a workspace over the HTTP API", function () {
  this.timeout(REQUEST_TIMEOUT_MS);
  const storage = useWorkspaceStorage(true);

  it("rename-moves-the-public-url: moves the files and the public URL, and the old URL stops answering", async () => {
    await seed("before", {
      locales: ["en", "fr"],
      keys: {
        "cart.empty": { en: "Your cart is empty", fr: "Votre panier est vide" },
      },
    });
    await seed("taken");
    const renamed = await lang("POST", "/workspace/rename", {
      id: "before",
      newId: "after",
    });
    expect(renamed.status).to.equal(200);
    expect(field(renamed.body, "id")).to.equal("after");
    expect(field(renamed.body, "locales")).to.deep.equal([
      { code: "en" },
      { code: "fr" },
    ]);
    expect((await send("/i18n/before/fr.json")).status).to.equal(404);
    const moved = await send("/i18n/after/fr.json");
    expect(moved.status).to.equal(200);
    expect(moved.body).to.deep.equal({
      cart: { empty: "Votre panier est vide" },
    });
    expect(storage.files("before")).to.deep.equal([]);
    expect(storage.files("after")).to.deep.equal([
      ".workspace.json",
      "en.json",
      "fr.json",
    ]);

    const onto = await lang("POST", "/workspace/rename", {
      id: "after",
      newId: "taken",
    });
    const reserved = await lang("POST", "/workspace/rename", {
      id: "after",
      newId: "default",
    });
    const missing = await lang("POST", "/workspace/rename", {
      id: "before",
      newId: "elsewhere",
    });
    expect(failure(onto)).to.deep.equal([409, "workspace_exists"]);
    expect(failure(reserved)).to.deep.equal([400, "reserved_workspace"]);
    expect(failure(missing)).to.deep.equal([404, "unknown_workspace"]);
  });

  it("delete-removes-everything: removes the files and the public URL and leaves the other workspaces alone", async () => {
    await seed("doomed", {
      locales: ["en", "fr"],
      keys: { "a.b": { en: "A", fr: "B" } },
    });
    await seed("kept", { keys: { "a.b": { en: "Kept" } } });
    const deleted = await lang("DELETE", "/workspace", { id: "doomed" });
    expect(deleted.status).to.equal(200);
    expect(storage.files("doomed")).to.deep.equal([]);
    const ids = objects(
      (await lang("GET", "/workspaces")).body,
      "workspaces",
    ).map((workspace) => workspace.id);
    expect(ids).to.not.include("doomed");
    expect(ids).to.include.members(["kept", "default"]);
    expect(storage.files("kept")).to.deep.equal([".workspace.json", "en.json"]);
    expect((await send("/i18n/doomed/fr.json")).status).to.equal(404);
    expect((await send("/i18n/kept/en.json")).body).to.deep.equal({
      a: { b: "Kept" },
    });
    const twice = await lang("DELETE", "/workspace", { id: "doomed" });
    expect(failure(twice)).to.deep.equal([404, "unknown_workspace"]);
  });
});

describe("[integration] stored workspace files and details over the HTTP API", function () {
  this.timeout(REQUEST_TIMEOUT_MS);
  const storage = useWorkspaceStorage(true);

  it("stored-files-stay-readable: lists and serves a folder written by hand in the stored layout and writes the same layout", async () => {
    const id = "handmade";
    const folder = storage.folder(id);
    mkdirSync(folder, { recursive: true });
    const tabbed = (value: JsonValue) =>
      `${JSON.stringify(value, null, "\t")}\n`;
    writeFileSync(
      join(folder, "en.json"),
      tabbed({ home: { title: "Home", intro: "Welcome {name}" } }),
    );
    writeFileSync(
      join(folder, "fr.json"),
      tabbed({ home: { title: "Accueil" } }),
    );
    writeFileSync(
      join(folder, ".workspace.json"),
      tabbed({
        defaultLocale: "en",
        locales: [{ code: "en" }, { code: "fr" }],
      }),
    );
    const summary = await lang("GET", `/workspace?workspace=${id}`);
    const flat = await lang("GET", `/flat?workspace=${id}`);
    expect([
      field(summary.body, "id"),
      field(summary.body, "kind"),
      field(summary.body, "defaultLocale"),
      field(summary.body, "locales"),
    ]).to.deep.equal([id, "added", "en", [{ code: "en" }, { code: "fr" }]]);
    expect(
      objects(flat.body, "rows").map((row) => [row.key, row.values]),
    ).to.deep.equal([
      ["home.title", { en: "Home", fr: "Accueil" }],
      ["home.intro", { en: "Welcome {name}" }],
    ]);
    expect(field(flat.body, "localeMissing")).to.deep.equal({ en: 0, fr: 1 });
    expect((await send(`/i18n/${id}/fr.json`)).body).to.deep.equal({
      home: { title: "Accueil" },
    });

    await lang("PUT", "/key", {
      workspace: id,
      path: "home.intro",
      values: { fr: "Bienvenue {name}" },
    });
    expect(storage.files(id)).to.deep.equal([
      ".workspace.json",
      "en.json",
      "fr.json",
    ]);
    expect(readJson(join(folder, "fr.json"))).to.deep.equal({
      home: { title: "Accueil", intro: "Bienvenue {name}" },
    });
    expect(
      field(readJson(join(folder, ".workspace.json")), "locales"),
    ).to.deep.equal([{ code: "en" }, { code: "fr" }]);
    const french = readText(join(folder, "fr.json"));
    expect(french).to.equal(
      '{\n\t"home": {\n\t\t"title": "Accueil",\n\t\t"intro": "Bienvenue {name}"\n\t}\n}\n',
    );

    await lang("POST", "/locale", { workspace: id, code: "de" });
    expect(readText(join(folder, "de.json"))).to.equal("{}\n");
    await lang("PUT", "/key", {
      workspace: id,
      path: "home.title",
      values: { de: "Start" },
    });
    expect(readText(join(folder, "de.json"))).to.equal(
      '{\n\t"home": {\n\t\t"title": "Start"\n\t}\n}\n',
    );
  });

  it("types-accepted: describes a workspace as dms, website, mobile or other and refuses any other type", async () => {
    for (const type of ["dms", "website", "mobile", "other"]) {
      const created = await lang("POST", "/workspace", {
        id: `type-${type}`,
        locale: { code: "en" },
        type,
      });
      expect(created.status, type).to.equal(200);
      expect(field(created.body, "type")).to.equal(type);
    }
    const bad = await lang("POST", "/workspace", {
      id: "type-desktop",
      locale: { code: "en" },
      type: "desktop",
    });
    expect(failure(bad)).to.deep.equal([400, "invalid_body"]);
  });

  it("description-is-at-most-500-characters: accepts 500 characters and refuses 501", async () => {
    await seed("desc");
    const ok = await lang("PATCH", "/workspace", {
      id: "desc",
      description: "d".repeat(500),
    });
    const bad = await lang("PATCH", "/workspace", {
      id: "desc",
      description: "d".repeat(501),
    });
    expect(ok.status).to.equal(200);
    expect(bad.status).to.equal(400);
  });
});
