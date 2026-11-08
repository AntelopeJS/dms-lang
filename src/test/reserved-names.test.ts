import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect } from "chai";
import { z } from "zod";
import {
  getTranslationConfig,
  setTranslationConfig,
  type TranslationConfig,
} from "../utils/config";
import { createWorkspace } from "../utils/workspaces";
import { expectError } from "./errors";
import { readJson } from "./helpers/files";

const LOCALE_DIR = join(__dirname, "../../frontend-vue/i18n/locales");
const LOCALES = ["en-GB", "fr-FR"];

const HINT_FILE = z.object({
  dms_lang: z.object({
    workspace_name: z.object({ invalid: z.string() }),
  }),
});

const RESERVED_CLAUSE_RE = /;\s*(.+?)\s+(?:are reserved|sont réservés)/;
const NAME_SEPARATOR_RE = /,\s*|\s+(?:and|et)\s+/;

/** The workspace names the New workspace dialog's hint says are reserved, in one locale. */
function hintedReservedNames(locale: string): string[] {
  const hint = HINT_FILE.parse(
    readJson(join(LOCALE_DIR, `lang-${locale}.json`)),
  ).dms_lang.workspace_name.invalid;
  const clause = RESERVED_CLAUSE_RE.exec(hint);
  return (clause?.[1] ?? "").split(NAME_SEPARATOR_RE);
}

describe("[integration] reserved workspace names", () => {
  let directory: string;
  let previous: TranslationConfig;

  before(() => {
    previous = getTranslationConfig();
    directory = mkdtempSync(join(tmpdir(), "dms-lang-reserved-"));
    setTranslationConfig({
      workspacesDir: join(directory, "ws"),
      editable: true,
    });
  });

  after(() => {
    setTranslationConfig(previous);
    rmSync(directory, { recursive: true, force: true });
  });

  for (const locale of LOCALES)
    it(`refuses every name the ${locale} hint calls reserved`, () => {
      const names = hintedReservedNames(locale);
      expect(names).to.include.members(["default", "modules"]);
      for (const name of names)
        expectError(
          () => createWorkspace(name, { code: "en" }),
          400,
          "reserved_workspace",
        );
    });
});
