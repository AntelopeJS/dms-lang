import { expect } from "chai";
import type { JsonValue } from "../utils/json";
import { type Answer, field, lang, objects, text } from "./helpers/api";
import { useWorkspaceStorage } from "./helpers/api-suite";
import { useProjectFiles } from "./helpers/project";

const REQUEST_TIMEOUT_MS = 20_000;

/** A write of a key of the project files. */
function write(
  method: string,
  path: string,
  values: Record<string, string>,
): Promise<Answer> {
  return lang(method, "/key", { workspace: "default", path, values });
}

/** The rows of the project files by key, read through the API. */
async function projectRows(): Promise<Map<string, JsonValue | undefined>> {
  const flat = await lang("GET", "/flat?workspace=default");
  return new Map(
    objects(flat.body, "rows").map((row) => [text(row, "key"), row.values]),
  );
}

describe("[integration] the project files over the HTTP API: reading", function () {
  this.timeout(REQUEST_TIMEOUT_MS);
  useWorkspaceStorage(true);
  const project = useProjectFiles();

  it("discovery-by-file-name: counts every <name>-<xx-XX>.json under the locales folder, subfolders included, ignores other names, and shows a file change on the next read", async () => {
    project.reset();
    project.put("crm-en-GB.json", { crm: { deals: { title: "Deals" } } });
    project.put("crm-fr-FR.json", { crm: { deals: { title: "Affaires" } } });
    project.put("team-en-US.json", { team: { name: "Team" } });
    project.put("nested/misc-en-GB.json", { misc: { note: "Nested" } });
    project.put("app-it.json", { ignored: { regionless: "no" } });
    project.put("en.json", { ignored: { bare: "no" } });
    project.put("app-de-DE.txt", { ignored: { extension: "no" } });
    const flat = await lang("GET", "/flat?workspace=default");
    const rows = await projectRows();
    expect(field(flat.body, "locales")).to.deep.equal(["en", "fr"]);
    expect(rows.get("crm.deals.title")).to.deep.equal({
      en: "Deals",
      fr: "Affaires",
    });
    expect(rows.get("team.name"), "en-US contributes to en").to.deep.equal({
      en: "Team",
    });
    expect(rows.get("misc.note"), "a subfolder is scanned").to.deep.equal({
      en: "Nested",
    });
    expect(rows.get("shop.title")).to.deep.equal({
      en: "Shop",
      fr: "Boutique",
    });
    expect(
      [...rows.keys()].filter((key) => key.startsWith("ignored.")),
    ).to.deep.equal([]);

    project.remove("team-en-US.json");
    project.put("crm-en-GB.json", {
      crm: { deals: { title: "Deals (edited)" } },
    });
    const after = await projectRows();
    expect(after.get("team.name")).to.equal(undefined);
    expect(after.get("crm.deals.title")).to.deep.equal({
      en: "Deals (edited)",
      fr: "Affaires",
    });
  });

  it("later-file-wins: merges files per language in file-name order and keeps the later file's text on a key both define", async () => {
    project.reset();
    project.put("a-en-GB.json", { x: { y: "from a", only_a: "A" } });
    project.put("b-en-GB.json", { x: { y: "from b", only_b: "B" } });
    const rows = await projectRows();
    expect(rows.get("x.y")).to.deep.equal({ en: "from b" });
    expect(rows.get("x.only_a")).to.deep.equal({ en: "A" });
    expect(rows.get("x.only_b")).to.deep.equal({ en: "B" });
  });
});

describe("[integration] the project files over the HTTP API: writing", function () {
  this.timeout(REQUEST_TIMEOUT_MS);
  useWorkspaceStorage(true);
  const project = useProjectFiles();

  it("writes-follow-the-defining-file: writes a key to the file that defines it, a new key to the file with the longest part of its namespace, else to app-<xx-XX>.json, else to the last file", async () => {
    project.reset();
    project.remove("app-en-GB.json");
    project.remove("app-fr-FR.json");
    project.put("app-en-GB.json", { shop: { title: "Shop" } });
    project.put("app-fr-FR.json", { shop: { title: "Boutique" } });
    project.put("app-zeta-fr-FR.json", { zeta: { word: "Zeta" } });
    project.put("crm-en-GB.json", {
      crm: { deals: { title: "Deals" }, contacts: { title: "Contacts" } },
    });
    project.put("crm-fr-FR.json", { crm: { deals: { title: "Affaires" } } });
    project.put("team-fr-FR.json", { team: { name: "Equipe" } });

    await write("PUT", "crm.deals.title", { fr: "Offres" });
    expect(project.read("crm-fr-FR.json", "crm", "deals", "title")).to.equal(
      "Offres",
    );
    expect(project.read("app-fr-FR.json")).to.deep.equal({
      shop: { title: "Boutique" },
    });

    await write("POST", "crm.deals.subtitle", {
      en: "Open deals",
      fr: "Offres ouvertes",
    });
    expect(project.read("crm-fr-FR.json", "crm", "deals", "subtitle")).to.equal(
      "Offres ouvertes",
    );
    expect(project.read("crm-en-GB.json", "crm", "deals", "subtitle")).to.equal(
      "Open deals",
    );

    await write("POST", "crm.contacts.phone", { fr: "Téléphone" });
    expect(project.read("crm-fr-FR.json", "crm", "contacts")).to.deep.equal({
      phone: "Téléphone",
    });

    await write("POST", "billing.total", { en: "Total", fr: "Somme" });
    expect(project.read("app-fr-FR.json", "billing")).to.deep.equal({
      total: "Somme",
    });
    expect(project.read("app-zeta-fr-FR.json")).to.deep.equal({
      zeta: { word: "Zeta" },
    });
    expect(project.read("app-en-GB.json", "billing")).to.deep.equal({
      total: "Total",
    });

    project.remove("app-fr-FR.json");
    await write("POST", "invoices.number", { en: "Number", fr: "Numéro" });
    expect(project.read("team-fr-FR.json", "invoices")).to.deep.equal({
      number: "Numéro",
    });
  });
});

describe("[integration] the project files over the HTTP API: changing and dropping", function () {
  this.timeout(REQUEST_TIMEOUT_MS);
  useWorkspaceStorage(true);
  const project = useProjectFiles();

  it("delete-uncovers-the-older-definition: changes only the winning definition when a key is deleted, cleared or renamed, so an older duplicate shows again", async () => {
    project.reset();
    project.put("a-en-GB.json", {
      dup: { one: "older one", two: "older two", three: "older three" },
    });
    project.put("b-en-GB.json", {
      dup: { one: "newer one", two: "newer two", three: "newer three" },
    });
    project.put("b-fr-FR.json", { dup: { two: "deux" } });
    const deleted = await lang("DELETE", "/key", {
      workspace: "default",
      path: "dup.one",
    });
    expect(deleted.status).to.equal(200);
    expect(project.read("b-en-GB.json", "dup")).to.deep.equal({
      two: "newer two",
      three: "newer three",
    });
    expect(project.read("a-en-GB.json", "dup", "one")).to.equal("older one");
    expect(field(deleted.body, "row", "values")).to.deep.equal({
      en: "older one",
    });

    const cleared = await write("PUT", "dup.two", { en: "" });
    expect(cleared.status).to.equal(200);
    expect(project.read("b-en-GB.json", "dup")).to.deep.equal({
      three: "newer three",
    });
    expect(field(cleared.body, "row", "values")).to.deep.equal({
      en: "older two",
      fr: "deux",
    });

    const renamed = await lang("POST", "/key/rename", {
      workspace: "default",
      path: "dup.three",
      newPath: "dup.moved",
    });
    expect(renamed.status).to.equal(200);
    expect(project.read("b-en-GB.json", "dup")).to.deep.equal({
      moved: "newer three",
    });
    expect(project.read("a-en-GB.json", "dup", "three")).to.equal(
      "older three",
    );
  });

  it("rename-stays-in-the-defining-file: keeps a renamed key in the file that defined it, whatever the namespace of the new name", async () => {
    project.reset();
    project.put("app-en-GB.json", { shop: { title: "Shop" } });
    project.put("crm-en-GB.json", { crm: { deals: { title: "Deals" } } });
    const renamed = await lang("POST", "/key/rename", {
      workspace: "default",
      path: "crm.deals.title",
      newPath: "shop.deals",
    });
    expect(renamed.status).to.equal(200);
    expect(project.read("crm-en-GB.json")).to.deep.equal({
      shop: { deals: "Deals" },
    });
    expect(project.read("app-en-GB.json")).to.deep.equal({
      shop: { title: "Shop" },
    });
  });

  it("dropping-an-override-removes-only-the-winning-one: drops the newest definition of a module's key and shows an older project definition again", async () => {
    project.reset();
    const key = "dms.button.save_changes";
    project.put("a-fr-FR.json", {
      dms: { button: { save_changes: "Older override" } },
    });
    project.put("b-fr-FR.json", {
      dms: { button: { save_changes: "Newer override" } },
    });
    const dropped = await lang("DELETE", "/key/override", {
      workspace: "default",
      path: key,
    });
    const row = await lang("GET", `/row?workspace=default&key=${key}`);
    expect(dropped.status).to.equal(200);
    expect(project.read("b-fr-FR.json", "dms")).to.equal(undefined);
    expect(
      project.read("a-fr-FR.json", "dms", "button", "save_changes"),
    ).to.equal("Older override");
    expect(field(row.body, "row", "values", "fr")).to.equal("Older override");
  });
});

describe("[integration] the texts of the installed modules over the HTTP API", function () {
  this.timeout(REQUEST_TIMEOUT_MS);
  useWorkspaceStorage(true);
  const project = useProjectFiles();
  const KEY = "dms.button.save_changes";
  const SHIPPED = { en: "Save changes", fr: "Enregistrer les modifications" };

  it("modules-workspace-is-read-only: lists the shipped texts and refuses every write", async () => {
    project.reset();
    const row = await lang("GET", `/row?workspace=modules&key=${KEY}`);
    expect(field(row.body, "row", "values")).to.deep.equal(SHIPPED);
    expect(field(row.body, "row", "overridden")).to.equal(false);
    const put = await lang("PUT", "/key", {
      workspace: "modules",
      path: KEY,
      values: { fr: "Sauver" },
    });
    const post = await lang("POST", "/key", {
      workspace: "modules",
      path: "mine.key",
      values: { en: "x" },
    });
    const del = await lang("DELETE", "/key", {
      workspace: "modules",
      path: KEY,
    });
    const locale = await lang("POST", "/locale", {
      workspace: "modules",
      code: "de",
    });
    for (const answer of [put, post, del])
      expect([answer.status, field(answer.body, "code")]).to.deep.equal([
        403,
        "read_only",
      ]);
    expect(locale.status).to.be.at.least(400);
  });

  it("override-a-module-text: overrides a module's key in the project files without touching the module, and dropping the override brings the module's text back", async () => {
    project.reset();
    const overridesOf = async () => {
      const summary = await lang("GET", "/summary");
      return objects(summary.body, "workspaces").find(
        (w) => w.id === "default",
      );
    };
    const before = await overridesOf();
    const written = await lang("PUT", "/key", {
      workspace: "default",
      path: KEY,
      values: { fr: "Enregistrer mes changements" },
    });
    expect(written.status).to.equal(200);
    expect(field(written.body, "row", "values")).to.deep.equal({
      fr: "Enregistrer mes changements",
    });
    expect(field(written.body, "row", "inherited")).to.deep.equal(SHIPPED);
    expect(
      project.read("app-fr-FR.json", "dms", "button", "save_changes"),
    ).to.equal("Enregistrer mes changements");
    expect(project.read("app-en-GB.json", "dms")).to.equal(undefined);

    const modules = await lang("GET", `/row?workspace=modules&key=${KEY}`);
    const after = await overridesOf();
    expect(field(modules.body, "row", "values")).to.deep.equal(SHIPPED);
    expect(field(modules.body, "row", "overridden")).to.equal(true);
    expect([before?.overrides, after?.overrides]).to.deep.equal([0, 1]);
    expect(after?.missing).to.equal(before?.missing);

    const dropped = await lang("DELETE", "/key/override", {
      workspace: "default",
      path: KEY,
    });
    const back = await lang("GET", `/row?workspace=default&key=${KEY}`);
    expect(dropped.status).to.equal(200);
    expect(field(back.body, "row")).to.equal(undefined);
    expect(project.read("app-fr-FR.json", "dms")).to.equal(undefined);
    const locked = await lang("DELETE", "/key", {
      workspace: "default",
      path: KEY,
    });
    expect(locked.status).to.equal(404);
  });
});
