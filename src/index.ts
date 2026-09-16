import path from "node:path";
import { AddFrontendModule } from "@antelopejs/interface-dms/page";
import { setTranslationConfig } from "./utils/config";
import { initializeLocaleRegistry } from "./utils/registry";

export * from "./pages";
export * from "./routes";

interface DmsLangConfig {
  editable?: boolean;
}

export async function construct(config: DmsLangConfig = {}): Promise<void> {
  const sourcePath = path.join(__dirname, "../frontend-vue");
  const workspacesDir = path.join(__dirname, "../i18n-workspaces");

  setTranslationConfig({
    workspacesDir,
    editable: config.editable ?? false,
  });

  await AddFrontendModule({
    name: "@antelopejs/dms-lang-frontend-vue",
    sourcePath,
    renderer: { name: "vue", version: "3" },
    configKey: "dmsLang",
    priority: 0,
  });
}

export async function start(): Promise<void> {
  await initializeLocaleRegistry();
}
