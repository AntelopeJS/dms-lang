import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  getTranslationConfig,
  setTranslationConfig,
  type TranslationConfig,
} from "../../utils/config";
import { type Answer, lang, ownerToken } from "./api";

/** Long enough for the first test of the run to register the owner (a password hash). */
const SETUP_TIMEOUT_MS = 60_000;

/** The folders of the workspaces a suite created. */
export interface WorkspaceStorage {
  /** The folder holding one folder per created workspace. */
  root(): string;
  /** The folder of one created workspace. */
  folder(id: string): string;
  /** The names in the folder of one created workspace, sorted; none when it is gone. */
  files(id: string): string[];
}

/**
 * Makes the module of the run store the workspaces a suite creates in a
 * folder of its own, writable or read-only, and has the platform owner
 * registered. Call it inside a `describe`.
 */
export function useWorkspaceStorage(editable: boolean): WorkspaceStorage {
  let directory = "";
  let previous: TranslationConfig;
  before(async function () {
    this.timeout(SETUP_TIMEOUT_MS);
    await ownerToken();
    previous = getTranslationConfig();
    directory = mkdtempSync(join(tmpdir(), "dms-lang-api-"));
    setTranslationConfig({ workspacesDir: join(directory, "ws"), editable });
  });
  after(() => {
    setTranslationConfig(previous);
    rmSync(directory, { recursive: true, force: true });
  });
  const root = () => getTranslationConfig().workspacesDir;
  return {
    root,
    folder: (id) => join(root(), id),
    files(id) {
      try {
        return readdirSync(join(root(), id)).sort();
      } catch {
        return [];
      }
    },
  };
}

/** Has the platform owner registered before the tests of the enclosing `describe` run. Call it inside a `describe`. */
export function useOwner(): void {
  before(async function () {
    this.timeout(SETUP_TIMEOUT_MS);
    await ownerToken();
  });
}

/** What a seeded workspace holds: its languages, the first being the base, and the texts of its keys by language. */
export interface Seed {
  locales?: string[];
  keys?: Record<string, Record<string, string>>;
}

/** Creates a workspace through the API, adds the languages and the keys, and answers the creation. */
export async function seed(id: string, content: Seed = {}): Promise<Answer> {
  const locales = content.locales ?? ["en"];
  const created = await lang("POST", "/workspace", {
    id,
    locale: { code: locales[0] },
  });
  for (const code of locales.slice(1))
    await lang("POST", "/locale", { workspace: id, code });
  for (const [path, values] of Object.entries(content.keys ?? {}))
    await lang("POST", "/key", { workspace: id, path, values });
  return created;
}
