import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect } from "chai";
import {
  getTranslationConfig,
  setTranslationConfig,
  type TranslationConfig,
} from "../utils/config";
import { keyStoreOf } from "../utils/key-stores";
import { createKey, updateKey } from "../utils/keys";
import { resolveFlat } from "../utils/resolve";
import { addLocale, createWorkspace } from "../utils/workspaces";

const WORKSPACE = "cache-shop";

describe("[integration] resolved workspaces are cached", () => {
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
});
