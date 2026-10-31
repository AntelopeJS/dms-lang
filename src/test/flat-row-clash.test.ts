import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect } from "chai";
import {
  getTranslationConfig,
  setTranslationConfig,
  type TranslationConfig,
} from "../utils/config";
import { resolveFlat, resolveRow } from "../utils/resolve";

const WORKSPACE = "clash";

describe("[integration] a key that is a namespace in one language file and a text in another", () => {
  let directory: string;
  let previous: TranslationConfig;

  before(() => {
    previous = getTranslationConfig();
    directory = mkdtempSync(join(tmpdir(), "dms-lang-clash-"));
    setTranslationConfig({ workspacesDir: directory, editable: true });
    const folder = join(directory, WORKSPACE);
    mkdirSync(folder);
    writeFileSync(
      join(folder, "en.json"),
      '{"a":{"x":"X"},"b":["p","q"],"c":"C"}',
    );
    writeFileSync(join(folder, "fr.json"), '{"a":"A","b":"B","c":"C"}');
    writeFileSync(
      join(folder, ".workspace.json"),
      JSON.stringify({
        defaultLocale: "en",
        locales: [{ code: "en" }, { code: "fr" }],
      }),
    );
  });

  after(() => {
    setTranslationConfig(previous);
    rmSync(directory, { recursive: true, force: true });
  });

  it("holds a text or nothing in each value of the flat view", () => {
    expect(resolveFlat(WORKSPACE).rows.map((row) => row.key)).to.deep.equal([
      "a",
      "b",
      "c",
    ]);
    expect(resolveRow(WORKSPACE, "a")?.values).to.deep.equal({
      en: undefined,
      fr: "A",
    });
    expect(resolveRow(WORKSPACE, "b")?.values).to.deep.equal({
      en: undefined,
      fr: "B",
    });
    expect(resolveRow(WORKSPACE, "c")?.values).to.deep.equal({
      en: "C",
      fr: "C",
    });
  });

  it("counts the language that holds no text for the key as missing it", () => {
    const flat = resolveFlat(WORKSPACE);
    expect(flat.localeMissing).to.deep.equal({ en: 2, fr: 0 });
    expect(flat.baseMissing).to.equal(2);
    expect(flat.incompleteKeys).to.equal(0);
  });
});
