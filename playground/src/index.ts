import path from "node:path";
import { AddFrontendModule } from "@antelopejs/interface-dms/page";

import "./welcome";

export async function construct(): Promise<void> {
  await AddFrontendModule({
    name: "playground-frontend-vue",
    sourcePath: path.join(__dirname, "../frontend-vue"),
    renderer: { name: "vue", version: "3" },
    configKey: "playground",
    priority: 1,
    options: { dmsI18nAppLayer: true },
  });
}

export async function start(): Promise<void> {}
