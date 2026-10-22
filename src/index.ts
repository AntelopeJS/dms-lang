import path from "node:path";
import { AddFrontendModule } from "@antelopejs/interface-dms/page";
import { setTranslationConfig } from "./utils/config";
import { initializeLocaleRegistry, stopLocaleRegistry } from "./utils/registry";
import { frontendModule } from "./frontend-module";

export * from "./pages";
export * from "./routes";

interface DmsLangConfig {
  editable?: boolean;
  /**
   * Where the created workspaces are stored; a relative path is resolved
   * against the working directory of the backend process. Defaults to the
   * module's own `i18n-workspaces` folder, which a reinstall of the module
   * wipes.
   */
  workspacesDir?: string;
}

const DEFAULT_WORKSPACES_DIR = path.join(__dirname, "../i18n-workspaces");

export async function construct(config: DmsLangConfig = {}): Promise<void> {
  const workspacesDir = path.resolve(
    config.workspacesDir ?? DEFAULT_WORKSPACES_DIR,
  );

  setTranslationConfig({
    workspacesDir,
    editable: config.editable ?? false,
  });

  await AddFrontendModule(frontendModule());
}

export async function start(): Promise<void> {
  await initializeLocaleRegistry();
}

export function stop(): void {
  stopLocaleRegistry();
}
