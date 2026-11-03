import { AddFrontendModule } from "@antelopejs/interface-dms/page";
import { frontendModule } from "./frontend-module";

import "./welcome";

export async function construct(): Promise<void> {
  await AddFrontendModule(frontendModule());
}

export async function start(): Promise<void> {}
