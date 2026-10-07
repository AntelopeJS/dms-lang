import { loadMessages } from "./registry";
import type { LocaleMessages } from "./tree";
import {
  loadWorkspaceMessages,
  type WorkspaceKind,
  workspaceKind,
} from "./workspaces";

const EXPORTERS: Record<WorkspaceKind, (workspace: string) => LocaleMessages> =
  {
    default: () => loadMessages("own"),
    modules: () => loadMessages("external"),
    added: (workspace) => loadWorkspaceMessages(workspace),
  };

export function exportWorkspace(workspace: string): LocaleMessages {
  return EXPORTERS[workspaceKind(workspace)](workspace);
}
