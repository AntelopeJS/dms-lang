import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect } from "chai";
import { localeStats } from "../utils/blocks";
import {
  getTranslationConfig,
  setTranslationConfig,
  type TranslationConfig,
} from "../utils/config";
import { keyStoreOf } from "../utils/key-stores";
import { createKey, updateKey } from "../utils/keys";
import { hasMessageIssue } from "../utils/message-check";
import { namespaceCoverage } from "../utils/namespaces";
import { flatCounts, resolveFlat, resolveRow } from "../utils/resolve";
import { addLocale, createWorkspace } from "../utils/workspaces";

const WORKSPACE = "cache-shop";

function issuesOf(key: string): string[] | undefined {
  return resolveRow(WORKSPACE, key)?.issues;
}

describe("[integration] resolved workspaces are cached and checked once", () => {
  let directory: string;
  let previous: TranslationConfig;

  before(() => {
    previous = getTranslationConfig();
    directory = mkdtempSync(join(tmpdir(), "dms-lang-cache-"));
    setTranslationConfig({ workspacesDir: directory, editable: true });
    createWorkspace(WORKSPACE, { code: "en" });
    addLocale(WORKSPACE, { code: "fr" });
    addLocale(WORKSPACE, { code: "de" });
    const store = keyStoreOf(WORKSPACE);
    createKey(store, "cart.total", { en: "Total {amount}", fr: "Total" });
    createKey(store, "cart.items", { en: "One | Many", fr: "Un | {count}" });
    createKey(store, "home.title", { en: "Home ", fr: "Accueil" });
  });

  after(() => {
    setTranslationConfig(previous);
    rmSync(directory, { recursive: true, force: true });
  });

  it("serves the same result until a write or a file changed by hand", () => {
    const first = resolveFlat(WORKSPACE);
    expect(resolveFlat(WORKSPACE)).to.equal(first);
    updateKey(keyStoreOf(WORKSPACE), "home.title", { de: "Start" });
    const written = resolveFlat(WORKSPACE);
    expect(written).to.not.equal(first);
    expect(written.localeMissing.de).to.equal(2);
    writeFileSync(join(directory, WORKSPACE, "de.json"), "{}");
    expect(resolveFlat(WORKSPACE).localeMissing.de).to.equal(3);
  });

  it("flags the texts with an issue, the base checked alone", () => {
    expect(issuesOf("cart.total")).to.deep.equal(["fr"]);
    expect(issuesOf("cart.items")).to.equal(undefined);
    expect(issuesOf("home.title")).to.deep.equal(["en"]);
    expect(hasMessageIssue("Hi", "Salut @")).to.equal(true);
    expect(hasMessageIssue("{n} item | {n} items", "{n} | {n} | {n}")).to.equal(
      true,
    );
    expect(hasMessageIssue("Hi {name}", "Salut {name}")).to.equal(false);
    expect(hasMessageIssue("Hi", "")).to.equal(false);
  });

  it("counts the issues of a language with the rule of the queue", () => {
    const stats = localeStats(WORKSPACE, "fr").items;
    expect(stats.find((item) => item.id === "issues")?.value).to.equal(1);
  });

  it("answers the figures a write changed with its row", () => {
    expect(flatCounts(WORKSPACE)).to.deep.include({
      totalKeys: 3,
      baseMissing: 0,
    });
    expect(resolveRow(WORKSPACE, "nope")).to.equal(undefined);
  });

  it("aggregates the coverage by namespace, the neediest first", () => {
    const coverage = namespaceCoverage(WORKSPACE);
    expect(coverage.locales).to.deep.equal(["de", "fr"]);
    expect(coverage.namespaces).to.deep.equal([
      { namespace: "cart", keys: 2, missing: { de: 2, fr: 0 } },
      { namespace: "home", keys: 1, missing: { de: 1, fr: 0 } },
    ]);
  });
});
