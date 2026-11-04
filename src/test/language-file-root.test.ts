import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect } from "chai";
import {
  getTranslationConfig,
  setTranslationConfig,
  type TranslationConfig,
} from "../utils/config";
import { readJson } from "../utils/json";
import { resolveFlat } from "../utils/resolve";
import { addLocale, createWorkspace } from "../utils/workspaces";

const NOT_OBJECTS = ['"hello"', '["a", "b"]', "5", "null", "true"];

describe("[integration] a language file whose root is not an object", () => {
  let directory: string;
  let previous: TranslationConfig;

  before(() => {
    previous = getTranslationConfig();
    directory = mkdtempSync(join(tmpdir(), "dms-lang-root-"));
    setTranslationConfig({ workspacesDir: directory, editable: true });
  });

  after(() => {
    setTranslationConfig(previous);
    rmSync(directory, { recursive: true, force: true });
  });

  it("is read as an empty file, like a file that is not JSON", () => {
    const file = join(directory, "root.json");
    for (const text of [...NOT_OBJECTS, "{ broken"]) {
      writeFileSync(file, text);
      expect(readJson(file), text).to.deep.equal({});
    }
    writeFileSync(file, '{"a":{"b":"B"},"c":["d"]}');
    expect(readJson(file)).to.deep.equal({ a: { b: "B" }, c: ["d"] });
  });

  it("lists no key of its own in the flat view", () => {
    NOT_OBJECTS.forEach((text, index) => {
      const workspace = `root-${index}`;
      createWorkspace(workspace, { code: "en" });
      addLocale(workspace, { code: "fr" });
      writeFileSync(join(directory, workspace, "en.json"), text);
      writeFileSync(join(directory, workspace, "fr.json"), '{"a":"A"}');
      expect(
        resolveFlat(workspace).rows.map((row) => row.key),
        text,
      ).to.deep.equal(["a"]);
    });
  });
});
