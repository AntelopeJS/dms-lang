import { getTranslationConfig } from "./config";
import { getLocaleCodes } from "./registry";
import {
  DEFAULT_WORKSPACE,
  listWorkspaces,
  MODULES_WORKSPACE,
  type WorkspaceSummary,
} from "./workspaces";

export const FALLBACK_LOCALE = "en";

function localeEntries(codes: string[]) {
  return codes.map((code) => ({ code }));
}

export function listAllWorkspaces(): WorkspaceSummary[] {
  const { editable } = getTranslationConfig();
  return [
    {
      id: DEFAULT_WORKSPACE,
      kind: "default",
      editable,
      defaultLocale: "",
      locales: localeEntries(getLocaleCodes("own")),
    },
    ...listWorkspaces(),
    {
      id: MODULES_WORKSPACE,
      kind: "modules",
      editable: false,
      defaultLocale: "",
      locales: localeEntries(getLocaleCodes("external")),
    },
  ];
}
