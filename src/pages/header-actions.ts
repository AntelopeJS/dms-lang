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

/** Why a button that writes to a workspace is disabled, by what stops it. */
const REASONS = {
  unknownWorkspace: "$dms_lang.scope.unknown_title",
  readOnly: "$dms_lang.scope.server_read_only_title",
  modulesKeys: "$dms_lang.errors.modules_read_only",
  lockedLanguages: "$dms_lang.language_add.locked_title",
} as const;

type Reason = (typeof REASONS)[keyof typeof REASONS];

/** What stops a write to a workspace, if anything does. */
type WorkspaceLock = (workspace: WorkspaceSummary) => Reason | undefined;

const KEY_LOCKS: Record<WorkspaceKind, Reason | undefined> = {
  default: undefined,
  added: undefined,
  modules: REASONS.modulesKeys,
};

const LANGUAGE_LOCKS: Record<WorkspaceKind, Reason | undefined> = {
  default: REASONS.lockedLanguages,
  added: undefined,
  modules: REASONS.lockedLanguages,
};

const WORKSPACE_QUERY = "workspace={{query.workspace}}";

/** The matrix filters a link to the matrix keeps, each left out when the page has none. */
const MATRIX_FILTERS =
  "filter={{query.filter}}&missingIn={{query.missingIn}}&namespace={{query.namespace}}&q={{query.q}}";

function serverLock(): Reason | undefined {
  return getTranslationConfig().editable ? undefined : REASONS.readOnly;
}

function knownWorkspace(id: string | undefined): WorkspaceSummary | undefined {
  try {
    return findWorkspace(id);
  } catch {
    return undefined;
  }
}

/** Disables a button while the workspace of the page URL refuses its write. */
function workspaceAvailability(lock: WorkspaceLock): CustomButtonAvailability {
  return ({ query }) => {
    const workspace = knownWorkspace(query?.workspace);
    const reason = workspace
      ? (serverLock() ?? lock(workspace))
      : REASONS.unknownWorkspace;
    return reason ? { reason } : undefined;
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
    availability: workspaceAvailability(
      (workspace) => LANGUAGE_LOCKS[workspace.kind],
    ),
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
    availability: workspaceAvailability(
      (workspace) => KEY_LOCKS[workspace.kind],
    ),
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
    availability: () => {
      const reason = serverLock();
      return reason ? { reason } : undefined;
    },
  };
}

/** The overview of the workspace of the URL. */
export const OPEN_OVERVIEW_BUTTON: CustomButton = {
  id: "open-overview",
  label: "$dms_lang.workspace.open_overview",
  icon: "i-ph-gauge",
  target: { type: "page", url: pageUrl("overview", WORKSPACE_QUERY) },
};

/** The matrix on the keys the language of the URL is missing, in its namespace. */
export const OPEN_MATRIX_BUTTON: CustomButton = {
  id: "open-matrix",
  label: "$dms_lang.queue.open_matrix",
  icon: "i-ph-table",
  target: {
    type: "page",
    url: pageUrl(
      "translations",
      `${WORKSPACE_QUERY}&filter=missing&missingIn={{query.locale}}&namespace={{query.namespace}}`,
    ),
  },
};
