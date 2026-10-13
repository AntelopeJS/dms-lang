import type {
  CustomButton,
  CustomButtonAvailability,
} from "@antelopejs/interface-dms/base/types/custom-button";
import type { Action } from "@antelopejs/interface-dms/component";
import { PAGE_ACTION_QUERY, PAGE_ACTIONS } from "./page-actions";
import { findWorkspace } from "../utils/catalog";
import { getTranslationConfig } from "../utils/config";
import { PAGES_URL } from "../utils/constants";
import type { WorkspaceKind, WorkspaceSummary } from "../utils/workspaces";

/** The workspace kinds that refuse new keys: the modules ship theirs. */
const KEYS_LOCKED: Record<WorkspaceKind, boolean> = {
  default: false,
  added: false,
  modules: true,
};

/** The workspace kinds that refuse new languages: only an added one takes them. */
const LANGUAGES_LOCKED: Record<WorkspaceKind, boolean> = {
  default: true,
  added: false,
  modules: true,
};

const HIDDEN = { hidden: true } as const;

const WORKSPACE_QUERY = "workspace={{query.workspace}}";

/** The matrix filters a link to the matrix keeps, each left out when the page has none. */
const MATRIX_FILTERS =
  "filter={{query.filter}}&missingIn={{query.missingIn}}&namespace={{query.namespace}}&q={{query.q}}";

function serverReadOnly(): boolean {
  return !getTranslationConfig().editable;
}

function knownWorkspace(id: string | undefined): WorkspaceSummary | undefined {
  try {
    return findWorkspace(id);
  } catch {
    return undefined;
  }
}

/** Hides a button while the workspace of the page URL refuses its write. */
function workspaceAvailability(
  locked: Record<WorkspaceKind, boolean>,
): CustomButtonAvailability {
  return ({ query }) => {
    const workspace = knownWorkspace(query?.workspace);
    const refused = !workspace || serverReadOnly() || locked[workspace.kind];
    return refused ? HIDDEN : undefined;
  };
}

function pageUrl(page: string, query: string): string {
  return `${PAGES_URL}/${page}?${query}`;
}

function pageActionQuery(action: string): string {
  return `${PAGE_ACTION_QUERY}=${action}`;
}

/** Opens the "add language" dialog of the overview, on the workspace of the URL. */
export function addLanguageButton(manageLanguages: Action): CustomButton {
  return {
    id: "add-language",
    label: "$dms_lang.languages.add",
    icon: "i-ph-plus",
    target: {
      type: "page",
      url: pageUrl(
        "overview",
        `${WORKSPACE_QUERY}&${pageActionQuery(PAGE_ACTIONS.addLanguage)}`,
      ),
    },
    permission: manageLanguages,
    availability: workspaceAvailability(LANGUAGES_LOCKED),
  };
}

/** Opens the "add key" dialog of the matrix, its filters kept. */
export function addKeyButton(manageKeys: Action): CustomButton {
  return {
    id: "add-key",
    label: "$dms_lang.key_add.title",
    icon: "i-ph-plus",
    color: "primary",
    target: {
      type: "page",
      url: pageUrl(
        "translations",
        `${WORKSPACE_QUERY}&${MATRIX_FILTERS}&${pageActionQuery(PAGE_ACTIONS.addKey)}`,
      ),
    },
    permission: manageKeys,
    availability: workspaceAvailability(KEYS_LOCKED),
  };
}

/** Opens the "new workspace" dialog of the workspaces page. */
export function newWorkspaceButton(createWorkspace: Action): CustomButton {
  return {
    id: "new-workspace",
    label: "$dms_lang.workspaces.new",
    icon: "i-ph-plus",
    color: "primary",
    target: {
      type: "page",
      url: pageUrl(
        "workspaces",
        `${WORKSPACE_QUERY}&${pageActionQuery(PAGE_ACTIONS.newWorkspace)}`,
      ),
    },
    permission: createWorkspace,
    availability: () => (serverReadOnly() ? HIDDEN : undefined),
  };
}

/** The overview of the workspace of the URL. */
export const OPEN_OVERVIEW_BUTTON: CustomButton = {
  id: "open-overview",
  label: "$dms_lang.workspace.open_overview",
  icon: "i-ph-gauge",
  target: { type: "page", url: pageUrl("overview", WORKSPACE_QUERY) },
};
