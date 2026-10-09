import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect } from "chai";
import { AddFrontendModule } from "@antelopejs/interface-dms/page";
import {
  createWorkspaceAction,
  deleteWorkspaceAction,
  editTranslationsAction,
  manageKeysAction,
  manageLanguagesAction,
  renameWorkspaceAction,
} from "../pages/actions";
import { listAllWorkspaces } from "../utils/catalog";
import {
  getTranslationConfig,
  setTranslationConfig,
  type TranslationConfig,
} from "../utils/config";
import { localeStats, workspaceAbout, workspaceKpis } from "../utils/blocks";
import { exportWorkspace } from "../utils/export";
import { initializeLocaleRegistry } from "../utils/registry";
import { resolveFlat } from "../utils/resolve";
import { countDefaultMissing, summarizeWorkspaces } from "../utils/summary";
import { addLocale, createWorkspace, upsertKey } from "../utils/workspaces";

const WORKSPACE = "storefront";

interface LocaleTree {
  [key: string]: string | LocaleTree;
}

function writeLocale(root: string, file: string, messages: LocaleTree): void {
  const directory = join(root, "i18n/locales");
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, file), JSON.stringify(messages));
}

async function registerSource(
  root: string,
  name: string,
  own: boolean,
): Promise<void> {
  await AddFrontendModule({
    name: `dms-lang-summary-${name}`,
    sourcePath: root,
    renderer: { name: "vue", version: "3" },
    priority: own ? 40 : 35,
    options: { dmsI18nAppLayer: own },
  });
}

describe("[integration] workspace summary, export and overrides", () => {
  let directory: string;
  let previous: TranslationConfig;

  before(async () => {
    previous = getTranslationConfig();
    directory = mkdtempSync(join(tmpdir(), "dms-lang-summary-"));
    const own = join(directory, "own");
    const external = join(directory, "external");
    writeLocale(own, "app-en-GB.json", { summaryFixture: { title: "Mine" } });
    writeLocale(external, "mod-en-GB.json", {
      summaryFixture: { title: "Module", body: "Module body" },
    });
    await registerSource(own, "own", true);
    await registerSource(external, "external", false);
    await initializeLocaleRegistry();
    setTranslationConfig({
      workspacesDir: join(directory, "workspaces"),
      editable: true,
    });
    createWorkspace(WORKSPACE, { code: "en-GB" });
    addLocale(WORKSPACE, { code: "it-IT" });
    upsertKey(WORKSPACE, "checkout.cta", {
      "en-GB": "Pay {amount}",
      "it-IT": "Paga",
    });
    upsertKey(WORKSPACE, "checkout.title", { "en-GB": "Checkout" });
  });

  after(() => {
    setTranslationConfig(previous);
    rmSync(directory, { recursive: true, force: true });
  });

  it("lists the project files, the created workspaces and the modules", () => {
    const ids = listAllWorkspaces().map((workspace) => workspace.id);
    expect(ids[0]).to.equal("default");
    expect(ids).to.include(WORKSPACE);
    expect(ids.at(-1)).to.equal("modules");
  });

  it("summarizes the size and coverage of a created workspace", () => {
    const storefront = summarizeWorkspaces("en").find(
      (workspace) => workspace.id === WORKSPACE,
    );
    expect(storefront).to.include({
      kind: "added",
      baseLocale: "en-GB",
      totalKeys: 2,
      translatedStrings: 3,
      missing: 1,
      coverage: 50,
    });
    expect(storefront?.localeMissing).to.deep.equal({ "en-GB": 0, "it-IT": 1 });
  });

  it("flags the module keys the project files redefine", () => {
    const rows = resolveFlat("modules", "en").rows;
    const title = rows.find((row) => row.key === "summaryFixture.title");
    const body = rows.find((row) => row.key === "summaryFixture.body");
    expect(title?.overridden).to.equal(true);
    expect(body?.overridden).to.equal(false);
    const stats = summarizeWorkspaces("en");
    const modules = stats.find((workspace) => workspace.id === "modules");
    const project = stats.find((workspace) => workspace.id === "default");
    expect(modules?.overrides).to.be.at.least(1);
    expect(project?.overrides).to.equal(modules?.overrides);
  });

  it("exports every language of a workspace", () => {
    expect(exportWorkspace(WORKSPACE)).to.deep.equal({
      "en-GB": { checkout: { cta: "Pay {amount}", title: "Checkout" } },
      "it-IT": { checkout: { cta: "Paga" } },
    });
    expect(exportWorkspace("default").en).to.have.property("summaryFixture");
  });

  it("counts the missing project translations for the navigation badge", () => {
    expect(countDefaultMissing()).to.be.a("number");
  });

  it("declares a permission for every write", () => {
    const ids = [
      editTranslationsAction,
      manageKeysAction,
      createWorkspaceAction,
      manageLanguagesAction,
      renameWorkspaceAction,
      deleteWorkspaceAction,
    ].map((action) => action.permissionId);
    expect(ids).to.deep.equal([
      "modules.lang.translate.translations.matrix.edit",
      "modules.lang.translate.translations.matrix.keys",
      "modules.lang.manage.workspaces.list.create",
      "modules.lang.manage.workspace.content.main.main.general.languages",
      "modules.lang.manage.workspace.content.main.main.danger.rename",
      "modules.lang.manage.workspace.content.main.main.danger.delete",
    ]);
  });
  it("serves the KPIs, the about list and a language's stats as block items", () => {
    const kpis = workspaceKpis(WORKSPACE).items;
    expect(kpis.map((item) => [item.id, item.value])).to.deep.include.members([
      ["languages", 2],
      ["keys", 2],
      ["missing", 1],
    ]);
    expect(kpis.find((item) => item.id === "languages")?.detail).to.deep.equal({
      key: "dms_lang.kpis.languages_detail",
      params: { n: { type: "count", value: 1 } },
    });
    const about = workspaceAbout(WORKSPACE).items;
    expect(about.find((item) => item.id === "folder")?.value).to.equal(
      `i18n-workspaces/${WORKSPACE}`,
    );
    const stats = localeStats(WORKSPACE, "it-IT").items;
    expect(stats.map((item) => [item.id, item.value])).to.deep.include.members([
      ["translated", 1],
      ["missing", 1],
      ["issues", 1],
    ]);
    expect(localeStats(WORKSPACE, "xx-XX").items).to.deep.equal([]);
  });
});
