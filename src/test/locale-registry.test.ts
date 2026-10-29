import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect } from "chai";
import { AddFrontendModule } from "@antelopejs/interface-dms/page";
import { createKey, updateKey } from "../utils/keys";
import { ownKeyStore } from "../utils/own";
import {
  getLocaleCodes,
  getOwnWriteTarget,
  initializeLocaleRegistry,
  loadMessages,
} from "../utils/registry";
import { resolveFlat } from "../utils/resolve";
import { readJson } from "./helpers/files";

/**
 * Well under the 2 s the registry used to poll the frontend modules at: a
 * late module shows up on `FrontendModulesChanged`, not on a timer.
 */
const LATE_MODULE_TIMEOUT_MS = 1000;
const POLL_MS = 100;

describe("[integration] registered locale sources", () => {
  let directory: string;

  before(() => {
    directory = mkdtempSync(join(tmpdir(), "dms-lang-registry-"));
  });
  after(() => {
    rmSync(directory, { recursive: true, force: true });
  });

  async function register(
    name: string,
    priority: number,
    own: boolean,
  ): Promise<string> {
    const sourcePath = join(directory, name);
    const localeDir = join(sourcePath, "i18n/locales");
    mkdirSync(localeDir, { recursive: true });
    const file = join(localeDir, "app-en-GB.json");
    writeFileSync(file, JSON.stringify({ migrationFixture: { winner: name } }));
    await AddFrontendModule({
      name: `dms-lang-test-${name}`,
      sourcePath,
      renderer: { name: "vue", version: "3" },
      priority,
      options: { dmsI18nAppLayer: own },
    });
    return file;
  }

  it("writes to the same highest-priority own source that supplies the visible value", async () => {
    const high = await register("high", 20, true);
    await register("external", 30, false);
    await register("low", 10, true);
    await initializeLocaleRegistry();
    expect(loadMessages("own").en.migrationFixture).to.deep.equal({
      winner: "high",
    });
    expect(getOwnWriteTarget("en", ["migrationFixture", "winner"])).to.equal(
      high,
    );
    writeFileSync(
      high,
      JSON.stringify({ migrationFixture: { winner: "edited" } }),
    );
    expect(loadMessages("own").en.migrationFixture).to.deep.equal({
      winner: "edited",
    });
    rmSync(high);
    expect(loadMessages("own").en.migrationFixture).to.deep.equal({
      winner: "low",
    });
  });

  it("lists a language file added to a locales folder without a restart", async () => {
    const sourcePath = join(directory, "added");
    mkdirSync(sourcePath, { recursive: true });
    await AddFrontendModule({
      name: "dms-lang-test-added",
      sourcePath,
      renderer: { name: "vue", version: "3" },
      priority: 40,
      options: { dmsI18nAppLayer: true },
    });
    await initializeLocaleRegistry();
    expect(getLocaleCodes("own")).to.not.include("de");
    const localeDir = join(sourcePath, "i18n/locales");
    mkdirSync(localeDir, { recursive: true });
    writeFileSync(
      join(localeDir, "app-de-DE.json"),
      JSON.stringify({ addedFixture: { title: "Neu" } }),
    );
    expect(getLocaleCodes("own")).to.include("de");
    expect(loadMessages("own").de.addedFixture).to.deep.equal({
      title: "Neu",
    });
  });

  it("moves cached messages and matrix rows when a module changes origin", async () => {
    const sourcePath = join(directory, "reclassified");
    const localeDir = join(sourcePath, "i18n/locales");
    mkdirSync(localeDir, { recursive: true });
    writeFileSync(
      join(localeDir, "app-fi-FI.json"),
      JSON.stringify({ reclassifiedFixture: { title: "Otsikko" } }),
    );
    const module = {
      name: "dms-lang-test-reclassified",
      sourcePath,
      renderer: { name: "vue", version: "3" },
      priority: 45,
    };
    for (const isOwn of [true, false, true]) {
      await AddFrontendModule({
        ...module,
        options: { dmsI18nAppLayer: isOwn },
      });
      await initializeLocaleRegistry();
      const owner = isOwn ? "own" : "external";
      const other = isOwn ? "external" : "own";
      expect(loadMessages(owner).fi?.reclassifiedFixture).to.deep.equal({
        title: "Otsikko",
      });
      expect(loadMessages(other).fi).to.equal(undefined);
      const project = resolveFlat("default");
      const installed = resolveFlat("modules");
      const owningRows = isOwn ? project : installed;
      const otherRows = isOwn ? installed : project;
      expect(owningRows.locales).to.include("fi");
      expect(
        owningRows.rows.find((row) => row.key === "reclassifiedFixture.title")
          ?.values.fi,
      ).to.equal("Otsikko");
      expect(otherRows.locales).to.not.include("fi");
      expect(
        otherRows.rows.some((row) => row.key === "reclassifiedFixture.title"),
      ).to.equal(false);
    }
  });
});

describe("[integration] project files split by domain or registered late", () => {
  let directory: string;

  before(() => {
    directory = mkdtempSync(join(tmpdir(), "dms-lang-project-"));
  });
  after(() => {
    rmSync(directory, { recursive: true, force: true });
  });

  it("writes each key to the project file of its domain", async () => {
    const sourcePath = join(directory, "split");
    const localeDir = join(sourcePath, "i18n/locales");
    mkdirSync(localeDir, { recursive: true });
    const crm = join(localeDir, "splitcrm-nl-NL.json");
    const team = join(localeDir, "splitteam-nl-NL.json");
    writeFileSync(crm, JSON.stringify({ splitCrm: { title: "CRM" } }));
    writeFileSync(team, JSON.stringify({ splitTeam: { title: "Team" } }));
    await AddFrontendModule({
      name: "dms-lang-test-split",
      sourcePath,
      renderer: { name: "vue", version: "3" },
      priority: 50,
      options: { dmsI18nAppLayer: true },
    });
    await initializeLocaleRegistry();
    updateKey(ownKeyStore(), "splitCrm.title", { nl: "Klanten" });
    createKey(ownKeyStore(), "splitCrm.subtitle", { nl: "Pijplijn" });
    expect(readJson(crm)).to.deep.equal({
      splitCrm: { title: "Klanten", subtitle: "Pijplijn" },
    });
    expect(readJson(team)).to.deep.equal({ splitTeam: { title: "Team" } });
  });

  it("follows a frontend module registered after the registry started", async function () {
    this.timeout(LATE_MODULE_TIMEOUT_MS);
    await initializeLocaleRegistry();
    const sourcePath = join(directory, "late");
    const localeDir = join(sourcePath, "i18n/locales");
    mkdirSync(localeDir, { recursive: true });
    writeFileSync(
      join(localeDir, "late-sv-SE.json"),
      JSON.stringify({ lateFixture: { title: "Sen" } }),
    );
    expect(getLocaleCodes("own")).to.not.include("sv");
    await AddFrontendModule({
      name: "dms-lang-test-late",
      sourcePath,
      renderer: { name: "vue", version: "3" },
      priority: 60,
      options: { dmsI18nAppLayer: true },
    });
    while (!getLocaleCodes("own").includes("sv"))
      await new Promise((resolve) => setTimeout(resolve, POLL_MS));
    expect(loadMessages("own").sv.lateFixture).to.deep.equal({ title: "Sen" });
  });
});
