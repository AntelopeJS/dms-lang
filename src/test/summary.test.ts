import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect } from "chai";
import type { RequestContext } from "@antelopejs/interface-api";
import { GetApiBaseUrl } from "@antelopejs/interface-dms/api-base-url";
import type { CustomButton } from "@antelopejs/interface-dms/base/types/custom-button";
import { AddFrontendModule } from "@antelopejs/interface-dms/page";
import {
  createWorkspaceAction,
  deleteWorkspaceAction,
  editTranslationsAction,
  manageKeysAction,
  manageLanguagesAction,
  renameWorkspaceAction,
} from "../pages/actions";
import {
  addKeyButton,
  addLanguageButton,
  newWorkspaceButton,
} from "../pages/header-actions";
import { workspaceGuard } from "../pages/workspace-guard";
import { findWorkspace, listAllWorkspaces } from "../utils/catalog";
import {
  getTranslationConfig,
  setTranslationConfig,
  type TranslationConfig,
} from "../utils/config";
import { localeStats, workspaceAbout, workspaceKpis } from "../utils/blocks";
import { exportWorkspace } from "../utils/export";
import { baseConfirm, removalConfirm } from "../utils/dialogs";
import { workspaceNotice } from "../utils/notices";
import { publicOrigin, workspaceEndpoint } from "../utils/public-url";
import { workspaceSnippet } from "../utils/snippets";
import { listLanguages } from "../utils/languages";
import { initializeLocaleRegistry } from "../utils/registry";
import { resolveFlat } from "../utils/resolve";
import { countDefaultMissing, summarizeWorkspaces } from "../utils/summary";
import { keyStoreOf } from "../utils/key-stores";
import { createKey } from "../utils/keys";
import { addLocale, createWorkspace } from "../utils/workspaces";
import { expectError } from "./errors";

const WORKSPACE = "storefront";
const ORIGIN = "http://127.0.0.1:5021";

interface PageTarget {
  type: "page";
  url: string;
}

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

function describeBlockRoutes(): void {
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
    expect(localeStats(WORKSPACE, "it-it").items).to.deep.equal(stats);
  });
  it("lists the languages of a workspace as source table rows", () => {
    const { results, total } = listLanguages(WORKSPACE);
    expect(total).to.equal(2);
    const base = results.find((row) => row.code === "en-GB");
    const italian = results.find((row) => row.code === "it-IT");
    expect(base).to.include({
      isBase: true,
      translated: 2,
      total: 2,
      canManage: true,
    });
    expect(base?.coverage).to.equal(100);
    expect(italian?.coverage).to.equal(50);
    expect(italian).to.include({
      isBase: false,
      translated: 1,
      missing: 1,
      workspace: WORKSPACE,
    });
    expect(italian?.name).to.equal("Italiano");
  });

  it("words the removal of a language and serves the app snippets", async () => {
    const dialog = removalConfirm(WORKSPACE, "it-IT", ORIGIN);
    expect(dialog).to.include({ confirmText: "it-IT", color: "error" });
    expect(dialog.impact?.[1]).to.include({ count: 1 });
    expect(dialog.params?.url).to.match(/\/i18n\/storefront\/it-IT\.json$/);
    expect(dialog.params?.code).to.equal("it-IT");
    expect(dialog.secondaryAction?.target).to.deep.equal({
      type: "download",
      url: "/i18n/{workspace}/{code}.json",
      filename: "{code}.json",
    });
    const endpoint = workspaceEndpoint(WORKSPACE, ORIGIN);
    expect(endpoint.items[0]).to.include({
      value: `${ORIGIN}/i18n/${WORKSPACE}/{locale}.json`,
    });
    const curl = workspaceSnippet(WORKSPACE, "curl", ORIGIN);
    expect(curl).to.include({ language: "shell" });
    expect(curl.code).to.match(/^curl .*\/i18n\/storefront\/en-GB\.json$/);
    const local = workspaceSnippet("default", "fetch", ORIGIN);
    expect(local.code).not.to.contain(`${ORIGIN}/i18n/`);
  });

  it("lists the keys a new base language has no text for", () => {
    const dialog = baseConfirm(WORKSPACE, "it-IT");
    expect(dialog).to.include({ missing: 1 });
    expect(dialog.keys).to.deep.equal(["checkout.title"]);
  });

  it("words the notices of the overview and the settings", () => {
    expect(workspaceNotice(WORKSPACE, "workspace").title).to.equal(
      "$dms_lang.notice.keys_title",
    );
    expect(workspaceNotice("modules", "overview").tone).to.equal("warning");
    expect(workspaceNotice("default", "overview")).to.deep.equal({});
  });

  it("builds the public URLs on the DMS API base URL, not on the request host", async () => {
    const context = { url: new URL("http://proxy.internal:8080/api") };
    const configured = await GetApiBaseUrl();
    expect(configured).to.be.a("string");
    expect(await publicOrigin(context as RequestContext)).to.equal(
      configured?.replace(/\/+$/, ""),
    );
  });

  it("guards the workspace blocks on the route answering 404 for an unknown workspace", () => {
    const { options } = workspaceGuard().serializeSync();
    expect(options).to.include({
      fetchUrl:
        "/api/lang/translations/workspace?workspace={{query.workspace}}",
      when: "notFound",
    });
    expect(findWorkspace(WORKSPACE).id).to.equal(WORKSPACE);
    expectError(() => findWorkspace("nope"), 404, "unknown_workspace");
  });
}

function availabilityOf(button: CustomButton, workspace?: string) {
  return button.availability?.({
    tenantId: "",
    user: undefined,
    query: workspace === undefined ? {} : { workspace },
  });
}

function describeHeaderActions(): void {
  it("disables the header writes the workspace of the URL refuses", async () => {
    const addKey = addKeyButton(manageKeysAction);
    expect(await availabilityOf(addKey, WORKSPACE)).to.equal(undefined);
    expect(await availabilityOf(addKey, "modules")).to.deep.equal({
      reason: "$dms_lang.errors.modules_read_only",
    });
    expect(await availabilityOf(addKey, "nope")).to.deep.equal({
      reason: "$dms_lang.scope.unknown_title",
    });
    const addLanguage = addLanguageButton(manageLanguagesAction);
    expect(await availabilityOf(addLanguage, WORKSPACE)).to.equal(undefined);
    expect(await availabilityOf(addLanguage)).to.deep.equal({
      reason: "$dms_lang.language_add.locked_title",
    });
  });

  it("disables every header write on a read-only server", async () => {
    const config = getTranslationConfig();
    setTranslationConfig({ ...config, editable: false });
    try {
      const reason = { reason: "$dms_lang.scope.server_read_only_title" };
      const newWorkspace = newWorkspaceButton(createWorkspaceAction);
      expect(await availabilityOf(newWorkspace)).to.deep.equal(reason);
      expect(
        await availabilityOf(addKeyButton(manageKeysAction), WORKSPACE),
      ).to.deep.equal(reason);
    } finally {
      setTranslationConfig(config);
    }
  });

  it("points the header links at the workspace of the URL", () => {
    expect(addKeyButton(manageKeysAction).target).to.deep.include({
      type: "page",
    });
    const url = (addKeyButton(manageKeysAction).target as PageTarget).url;
    expect(url).to.include("workspace={{query.workspace}}");
    expect(url).to.include("q={{query.q}}");
    expect(url).to.match(/action=add-key$/);
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
    createKey(keyStoreOf(WORKSPACE), "checkout.cta", {
      "en-GB": "Pay {amount}",
      "it-IT": "Paga",
    });
    createKey(keyStoreOf(WORKSPACE), "checkout.title", { "en-GB": "Checkout" });
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
    const storefront = summarizeWorkspaces().find(
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
    expect(storefront?.localeProgress).to.deep.equal({
      "en-GB": 100,
      "it-IT": 50,
    });
    const kpi = workspaceKpis(WORKSPACE).items.find(
      (item) => item.id === "coverage",
    );
    expect(kpi?.value).to.deep.equal({
      key: "dms_lang.common.value",
      params: { value: { type: "number", value: 0.5, format: "percent" } },
    });
  });

  it("flags the module keys the project files redefine", () => {
    const rows = resolveFlat("modules").rows;
    const title = rows.find((row) => row.key === "summaryFixture.title");
    const body = rows.find((row) => row.key === "summaryFixture.body");
    expect(title?.overridden).to.equal(true);
    expect(body?.overridden).to.equal(false);
    const stats = summarizeWorkspaces();
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
      "modules.lang.translate.translations.scoped.matrix.edit",
      "modules.lang.translate.translations.scoped.matrix.keys",
      "modules.lang.manage.workspaces.list.create",
      "modules.lang.manage.workspace.scoped.content.main.main.general.languages",
      "modules.lang.manage.workspace.scoped.content.main.main.danger.rename",
      "modules.lang.manage.workspace.scoped.content.main.main.danger.delete",
    ]);
  });
  describeBlockRoutes();
  describeHeaderActions();
});
