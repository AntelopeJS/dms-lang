import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import { expect } from "chai";
import { workspaceKpis } from "../utils/blocks";
import { resolveWorkspaceId } from "../utils/catalog";
import {
  getTranslationConfig,
  setTranslationConfig,
  type TranslationConfig,
} from "../utils/config";
import { backupWorkspace, importWorkspace } from "../utils/export";
import {
  baseConfirm,
  removalConfirm,
  workspaceSnippet,
} from "../utils/integration";
import { listLanguages } from "../utils/languages";
import { keyStoreOf } from "../utils/key-stores";
import { createKey, updateKey } from "../utils/keys";
import { resolveFlat } from "../utils/resolve";
import {
  addLocale,
  createWorkspace,
  listWorkspaces,
  readWorkspaceLocale,
  removeLocale,
  setWorkspaceDefaultLocale,
  updateWorkspaceDetails,
} from "../utils/workspaces";
import type { SortDirection, SortedColumn } from "../validation/query.schema";
import { expectError } from "./errors";

const WORKSPACE = "core-shop";
const API_BASE = "http://127.0.0.1:5021";

/** The keys KPI with two keys missing their base text: the namespaces, then the warning. */
const KEYS_DETAIL = {
  key: "dms_lang.kpis.keys_detail_base_missing",
  params: {
    namespaces: {
      key: "dms_lang.kpis.keys_detail",
      params: { n: { type: "count", value: 1 } },
    },
    missing: {
      key: "dms_lang.kpis.keys_base_missing",
      params: { n: { type: "count", value: 2 } },
    },
  },
};

function writeFile(path: string, data: unknown): void {
  writeFileSync(path, JSON.stringify(data));
}

describe("[integration] workspace data model", () => {
  let directory: string;
  let previous: TranslationConfig;

  before(() => {
    previous = getTranslationConfig();
    directory = mkdtempSync(join(tmpdir(), "dms-lang-workspaces-"));
    setTranslationConfig({
      workspacesDir: join(directory, "ws"),
      editable: true,
    });
    createWorkspace(
      "Core-Shop",
      { code: "en_gb" },
      { description: "Shop", type: "website" },
    );
    addLocale(WORKSPACE, { code: "fr" });
    addLocale(WORKSPACE, { code: "nl" });
    createKey(keyStoreOf(WORKSPACE), "home.title", {
      "en-GB": "Home",
      fr: "Accueil",
    });
    createKey(keyStoreOf(WORKSPACE), "home.cta", { "en-GB": "Buy" });
  });

  after(() => {
    setTranslationConfig(previous);
    rmSync(directory, { recursive: true, force: true });
  });

  it("stores ids in lower case and compares them without case", () => {
    expect(listWorkspaces().map((workspace) => workspace.id)).to.deep.equal([
      WORKSPACE,
    ]);
    expect(resolveWorkspaceId("CORE-SHOP")).to.equal(WORKSPACE);
    expect(listWorkspaces()[0]).to.include({
      description: "Shop",
      type: "website",
    });
  });

  it("answers 404 for an unknown workspace without any disk path", () => {
    const body = expectError(
      () => resolveWorkspaceId("nope"),
      404,
      "unknown_workspace",
    );
    expect(body.message).to.equal("$dms_lang.errors.unknown_workspace");
    expect(body.id).to.equal("nope");
    expectError(() => resolveFlat("nope"), 404, "unknown_workspace");
  });

  it("lists a folder created by hand with capitals under its lower-case id", () => {
    mkdirSync(join(directory, "ws", "Core-Upper"));
    writeFile(join(directory, "ws", "Core-Upper", "en.json"), { hello: "Hi" });
    expect(resolveFlat("core-upper").totalKeys).to.equal(1);
    expectError(
      () => createWorkspace("CORE-UPPER", { code: "en" }),
      409,
      "workspace_exists",
    );
    rmSync(join(directory, "ws", "Core-Upper"), { recursive: true });
  });

  it("detects duplicate languages on the canonical code and keeps the base", () => {
    expectError(
      () => addLocale(WORKSPACE, { code: "EN-gb" }),
      409,
      "locale_exists",
    );
    expect(addLocale(WORKSPACE, { code: "fr_be" })).to.deep.equal({
      code: "fr-BE",
      sameLanguage: ["fr"],
    });
    expectError(() => removeLocale(WORKSPACE, "en-GB"), 409, "base_locale");
    removeLocale(WORKSPACE, "FR-be");
  });

  it("takes the keys of every language and counts an empty base as missing", () => {
    writeFile(join(directory, "ws", WORKSPACE, "nl.json"), {
      home: { only_nl: "Alleen", blank: "  " },
    });
    const flat = resolveFlat(WORKSPACE);
    expect(flat.rows.map((row) => row.key)).to.include.members([
      "home.title",
      "home.cta",
      "home.only_nl",
      "home.blank",
    ]);
    expect(flat.baseMissing).to.equal(2);
    expect(flat.localeMissing.nl).to.equal(3);
    const keys = workspaceKpis(WORKSPACE).items.find(
      (item) => item.id === "keys",
    );
    expect(keys?.detail).to.deep.equal(KEYS_DETAIL);
    expect(keys?.detailTone).to.equal("warning");
    setWorkspaceDefaultLocale(WORKSPACE, "nl");
    expect(resolveFlat(WORKSPACE).totalKeys).to.equal(flat.totalKeys);
    setWorkspaceDefaultLocale(WORKSPACE, "en-GB");
    writeFile(join(directory, "ws", WORKSPACE, "nl.json"), {});
  });

  it("flags a translation written for an older base text", () => {
    updateKey(keyStoreOf(WORKSPACE), "home.title", { fr: "Accueil" });
    updateKey(keyStoreOf(WORKSPACE), "home.title", { "en-GB": "Homepage" });
    const row = resolveFlat(WORKSPACE).rows.find(
      (entry) => entry.key === "home.title",
    );
    expect(row?.outdated).to.deep.equal(["fr"]);
    updateKey(keyStoreOf(WORKSPACE), "home.title", { fr: "Page d'accueil" });
    const fixed = resolveFlat(WORKSPACE).rows.find(
      (entry) => entry.key === "home.title",
    );
    expect(fixed?.outdated).to.equal(undefined);
    const files = readFileSync(
      join(directory, "ws", WORKSPACE, "fr.json"),
      "utf-8",
    );
    expect(JSON.parse(files)).to.deep.equal({
      home: { title: "Page d'accueil" },
    });
  });

  it("stops a write on a manifest that is not valid JSON instead of wiping it", () => {
    createWorkspace("core-corrupt", { code: "en" }, { description: "Kept" });
    const manifest = join(directory, "ws", "core-corrupt", ".workspace.json");
    writeFileSync(manifest, "{ broken");
    expectError(
      () => updateWorkspaceDetails("core-corrupt", { type: "website" }),
      500,
      "server_error",
    );
    expectError(
      () => addLocale("core-corrupt", { code: "fr" }),
      500,
      "server_error",
    );
    expect(readFileSync(manifest, "utf-8")).to.equal("{ broken");
  });

  describeLanguages();
  describePublicAccess();
});

function describeLanguages(): void {
  it("answers 404 when confirming a language the workspace does not have", () => {
    expectError(() => baseConfirm(WORKSPACE, "de"), 404, "unknown_locale");
    expectError(
      () => removalConfirm(WORKSPACE, "xx", API_BASE),
      404,
      "unknown_locale",
    );
    expect(removalConfirm(WORKSPACE, "NL", API_BASE).params?.file).to.equal(
      "nl.json",
    );
  });

  it("keeps the base on top whatever the sort of the languages", () => {
    const codes = (sortKey?: SortedColumn, sortDirection?: SortDirection) =>
      listLanguages(WORKSPACE, { sortKey, sortDirection }).results.map(
        (row) => row.code,
      );
    expect(codes("name")).to.deep.equal(["en-GB", "fr", "nl"]);
    expect(codes("name", "desc")).to.deep.equal(["en-GB", "nl", "fr"]);
    expect(codes("coverage", "desc")).to.deep.equal(["en-GB", "fr", "nl"]);
    expect(codes()).to.deep.equal(["en-GB", "nl", "fr"]);
  });

  it("fills a partial file from its language and the base in the fetch snippet", async () => {
    addLocale(WORKSPACE, { code: "fr-BE" });
    const { workspacesDir } = getTranslationConfig();
    writeFile(join(workspacesDir, WORKSPACE, "fr-BE.json"), {
      home: { cta: "Acheter" },
    });
    const served = async (url: string) => {
      const code = url.split("/").pop()?.replace(".json", "") ?? "";
      const file = readWorkspaceLocale(WORKSPACE, code);
      return { ok: file !== null, json: async () => file?.messages };
    };
    const { code } = workspaceSnippet(WORKSPACE, "fetch", API_BASE);
    // The snippet as an app runs it, with the files of the workspace served.
    const run = async (language: string) => {
      const messages = await runInNewContext(
        `(async () => { ${code}
return messages; })()`,
        { fetch: served, navigator: { language } },
      );
      return JSON.parse(JSON.stringify(messages));
    };
    expect(await run("fr-BE")).to.deep.equal({
      home: { title: "Page d'accueil", cta: "Acheter" },
    });
    expect(await run("nl-BE")).to.deep.equal({
      home: { title: "Homepage", cta: "Buy" },
    });
    removeLocale(WORKSPACE, "fr-BE");
  });
}

function describePublicAccess(): void {
  it("serves the language alone when the exact code does not exist", () => {
    expect(readWorkspaceLocale(WORKSPACE, "fr-FR")?.code).to.equal("fr");
    expect(readWorkspaceLocale("CORE-SHOP", "EN-GB")?.code).to.equal("en-GB");
    expect(readWorkspaceLocale(WORKSPACE, "de")).to.equal(null);
    expect(readWorkspaceLocale("default", "en")).to.equal(null);
  });

  it("opens the public files to any origin, preflight included", async () => {
    const url = `${API_BASE}/i18n/${WORKSPACE}/fr-FR.json`;
    const origin = { Origin: "https://www.example.com" };
    const response = await fetch(url, { headers: origin });
    expect(response.status).to.equal(200);
    expect(response.headers.get("access-control-allow-origin")).to.equal("*");
    expect(response.headers.get("access-control-allow-credentials")).to.equal(
      null,
    );
    expect(response.headers.get("content-language")).to.equal("fr");
    const preflight = await fetch(url, {
      method: "OPTIONS",
      headers: { ...origin, "Access-Control-Request-Method": "GET" },
    });
    expect(preflight.status).to.equal(204);
    expect(preflight.headers.get("access-control-allow-origin")).to.equal("*");
    const missing = await fetch(`${API_BASE}/i18n/${WORKSPACE}/de.json`, {
      headers: origin,
    });
    expect(missing.status).to.equal(404);
    expect(missing.headers.get("access-control-allow-origin")).to.equal("*");
  });

  it("backs a workspace up with its manifest and restores it", () => {
    const backup = backupWorkspace(WORKSPACE);
    expect(backup).to.include({
      format: "dms-lang.workspace",
      defaultLocale: "en-GB",
      type: "website",
    });
    const id = importWorkspace({ ...backup, id: "core-restored" });
    expect(backupWorkspace(id).messages).to.deep.equal(backup.messages);
    expectError(
      () => importWorkspace({ ...backup, id }),
      409,
      "workspace_exists",
    );
    expectError(
      () => importWorkspace({ id: "core-bad", messages: { en: { a: 1 } } }),
      400,
      "invalid_value",
    );
    const legacy = importWorkspace({
      id: "core-legacy",
      messages: { fr: { a: "A" }, en: { a: "B" } },
    });
    expect(backupWorkspace(legacy).defaultLocale).to.equal("fr");
  });

  it("imports a backup through the checks of a key write", () => {
    const imported = importWorkspace({
      id: "core-checked",
      locales: [{ code: "EN", name: " English ", flag: 42 } as never],
      messages: { en: { a: { b: "B", empty: " " }, gone: { x: "" } } },
    });
    const backup = backupWorkspace(imported);
    expect(backup.messages).to.deep.equal({ en: { a: { b: "B" } } });
    expect(backup.locales).to.deep.equal([{ code: "en", name: "English" }]);
    expectError(
      () =>
        importWorkspace({ id: "core-mail", messages: { en: { a: "x@y" } } }),
      400,
      "invalid_message",
    );
    expectError(
      () =>
        importWorkspace({
          id: "core-clash",
          messages: { en: { a: "A" }, fr: { a: { b: "B" } } },
        }),
      409,
      "key_conflict",
    );
    expectError(
      () =>
        importWorkspace({ id: "core-dots", messages: { en: { "a.b": "A" } } }),
      400,
      "invalid_key_path",
    );
  });
}
