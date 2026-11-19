import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { AddFrontendModule } from "@antelopejs/interface-dms/page";
import type { JsonValue } from "../../utils/json";
import { initializeLocaleRegistry } from "../../utils/registry";
import { readJson } from "./files";
import { field } from "./api";

/** The texts of the project files a fresh project starts with. */
const PROJECT_FILES = {
  "app-en-GB.json": {
    shop: {
      title: "Shop",
      pay: "Pay {price}",
      cancel: "Cancel order",
      total: "Total {amount}",
    },
    auth: { login: "Sign in" },
  },
  "app-fr-FR.json": {
    shop: { title: "Boutique", pay: "Payer {price}", total: "Total {montant}" },
    auth: { login: "Connexion" },
  },
};

/** The locale files of the application layer the run's DMS reports to the module as the project. */
export interface ProjectFiles {
  /** Starts the project over: the folder holds the files of a fresh project and nothing else. */
  reset(): void;
  /** Writes a locale file under the locales folder, subfolders included. */
  put(name: string, messages: JsonValue): void;
  /** Removes a locale file. */
  remove(name: string): void;
  /** A field of a locale file, or the whole file when no field is named. */
  read(name: string, ...path: string[]): JsonValue | undefined;
  /** The folder holding the locales folder and the `layers` folder of the project. */
  root(): string;
}

/**
 * Registers a frontend module flagged as the application layer, whose
 * `i18n/locales` folder is the project the module lists as `default`. Call it
 * inside a `describe`.
 */
export function useProjectFiles(): ProjectFiles {
  let directory = "";
  const root = () => join(directory, "project");
  const locales = () => join(root(), "i18n", "locales");
  const project: ProjectFiles = {
    root,
    reset() {
      rmSync(root(), { recursive: true, force: true });
      mkdirSync(locales(), { recursive: true });
      for (const [name, messages] of Object.entries(PROJECT_FILES))
        project.put(name, messages);
    },
    put(name, messages) {
      const file = join(locales(), name);
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, `${JSON.stringify(messages, null, 2)}\n`);
    },
    remove: (name) => rmSync(join(locales(), name)),
    read: (name, ...path) => field(readJson(join(locales(), name)), ...path),
  };
  before(async () => {
    directory = mkdtempSync(join(tmpdir(), "dms-lang-http-project-"));
    project.reset();
    await AddFrontendModule({
      name: "dms-lang-test-http-project",
      sourcePath: root(),
      renderer: { name: "vue", version: "3" },
      priority: 70,
      options: { dmsI18nAppLayer: true },
    });
    await initializeLocaleRegistry();
  });
  after(() => {
    rmSync(directory, { recursive: true, force: true });
  });
  return project;
}
