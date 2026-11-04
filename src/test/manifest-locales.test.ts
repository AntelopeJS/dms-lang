import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect } from "chai";
import {
  getTranslationConfig,
  setTranslationConfig,
  type TranslationConfig,
} from "../utils/config";
import {
  getWorkspaceManifest,
  getWorkspaceSummary,
  listWorkspaces,
} from "../utils/workspaces";

describe("[integration] a workspace manifest edited by hand", () => {
  let directory: string;
  let previous: TranslationConfig;

  before(() => {
    previous = getTranslationConfig();
    directory = mkdtempSync(join(tmpdir(), "dms-lang-manifest-"));
    setTranslationConfig({ workspacesDir: directory, editable: true });
  });

  after(() => {
    setTranslationConfig(previous);
    rmSync(directory, { recursive: true, force: true });
  });

  function workspaceWith(id: string, manifest: string): void {
    const folder = join(directory, id);
    mkdirSync(folder);
    writeFileSync(join(folder, "en.json"), "{}");
    writeFileSync(join(folder, "fr.json"), "{}");
    writeFileSync(join(folder, ".workspace.json"), manifest);
  }

  it("reads a locale entry that is not an object as absent", () => {
    workspaceWith("null-entry", '{"locales":[null,"fr",7,["en"]]}');
    expect(getWorkspaceManifest("null-entry").locales).to.deep.equal([
      { code: "en" },
      { code: "fr" },
    ]);
    expect(getWorkspaceSummary("null-entry").locales).to.deep.equal([
      { code: "en" },
      { code: "fr" },
    ]);
    expect(listWorkspaces().map((summary) => summary.id)).to.include(
      "null-entry",
    );
  });

  it("reads a locale list that is not a list as absent", () => {
    workspaceWith("object-locales", '{"locales":{"code":"fr","name":"F"}}');
    expect(getWorkspaceManifest("object-locales").locales).to.deep.equal([
      { code: "en" },
      { code: "fr" },
    ]);
  });

  it("reads a locale entry whose code, name or flag is not a text as absent", () => {
    workspaceWith(
      "bad-names",
      JSON.stringify({
        locales: [
          { code: "fr", name: 3 },
          { code: 5, name: "Five" },
          { code: "en", flag: ["x"] },
        ],
      }),
    );
    expect(getWorkspaceManifest("bad-names").locales).to.deep.equal([
      { code: "en" },
      { code: "fr" },
    ]);
  });

  it("keeps the entries whose fields are texts", () => {
    workspaceWith(
      "good-names",
      JSON.stringify({
        defaultLocale: "fr",
        locales: [
          { code: "en", name: "English" },
          { code: "fr", name: "Français", flag: "fr" },
        ],
      }),
    );
    const manifest = getWorkspaceManifest("good-names");
    expect(manifest.defaultLocale).to.equal("fr");
    expect(manifest.locales).to.deep.equal([
      { code: "en", name: "English" },
      { code: "fr", name: "Français", flag: "fr" },
    ]);
  });

  it("keeps the texts of the sources and leaves out the other values", () => {
    workspaceWith(
      "sources",
      JSON.stringify({
        sources: { fr: { a: "hash", b: 5, c: null }, en: null, de: "x" },
      }),
    );
    expect(getWorkspaceManifest("sources").sources).to.deep.equal({
      fr: { a: "hash" },
    });
  });
});
