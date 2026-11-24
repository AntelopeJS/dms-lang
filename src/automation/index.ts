import { addLanguageAction } from "./actions/add-language";
import { createKeyAction } from "./actions/create-key";
import { createWorkspaceAction } from "./actions/create-workspace";
import { deleteKeyAction } from "./actions/delete-key";
import { deleteWorkspaceAction } from "./actions/delete-workspace";
import { exportWorkspaceAction } from "./actions/export-workspace";
import { getKeyAction } from "./actions/get-key";
import { importLanguageAction } from "./actions/import-language";
import { importWorkspaceAction } from "./actions/import-workspace";
import { keysToReviewAction } from "./actions/keys-to-review";
import { languageCoverageAction } from "./actions/language-coverage";
import { listWorkspacesAction } from "./actions/list-workspaces";
import { markReviewedAction } from "./actions/mark-reviewed";
import { missingKeysAction } from "./actions/missing-keys";
import { namespaceCoverageAction } from "./actions/namespace-coverage";
import { publicUrlAction } from "./actions/public-url";
import { removeLanguageAction } from "./actions/remove-language";
import { removeOverrideAction } from "./actions/remove-override";
import { renameKeyAction } from "./actions/rename-key";
import { renameWorkspaceAction } from "./actions/rename-workspace";
import { setBaseLanguageAction } from "./actions/set-base-language";
import { setTranslationAction } from "./actions/set-translation";
import { translateAction } from "./actions/translate";
import { updateWorkspaceAction } from "./actions/update-workspace";
import { workspaceSummaryAction } from "./actions/workspace-summary";
import { checkMessageData } from "./data/check-message";
import { formatMessageData } from "./data/format-message";
import { languageNameData } from "./data/language-name";
import { clearLangChannels } from "./events";
import { AutomationRegistrationLifecycle } from "./registration-lifecycle";
import { baseTextChangedTrigger } from "./triggers/base-text-changed";
import { coverageBelowTrigger } from "./triggers/coverage-below";
import { languageCompletedTrigger } from "./triggers/language-completed";
import { moduleTextsChangedTrigger } from "./triggers/module-texts-changed";
import { translationsChangedTrigger } from "./triggers/translations-changed";

const AUTOMATION_INTERFACE_PACKAGE = "@antelopejs/interface-dms-automation";

type AutomationInterface =
  typeof import("@antelopejs/interface-dms-automation");

interface ModuleLoadError extends Error {
  code?: string;
}

export const LANG_TRIGGERS = [
  translationsChangedTrigger,
  baseTextChangedTrigger,
  languageCompletedTrigger,
  coverageBelowTrigger,
  moduleTextsChangedTrigger,
];

export const LANG_WRITE_ACTIONS = [
  setTranslationAction,
  createKeyAction,
  markReviewedAction,
  addLanguageAction,
  importLanguageAction,
  createWorkspaceAction,
  importWorkspaceAction,
  renameKeyAction,
  deleteKeyAction,
  removeOverrideAction,
  removeLanguageAction,
  setBaseLanguageAction,
  updateWorkspaceAction,
  renameWorkspaceAction,
  deleteWorkspaceAction,
];

export const LANG_READ_ACTIONS = [
  translateAction,
  getKeyAction,
  missingKeysAction,
  keysToReviewAction,
  languageCoverageAction,
  namespaceCoverageAction,
  workspaceSummaryAction,
  exportWorkspaceAction,
  listWorkspacesAction,
  publicUrlAction,
];

export const LANG_ACTIONS = [...LANG_WRITE_ACTIONS, ...LANG_READ_ACTIONS];

export const LANG_DATA_NODES = [
  formatMessageData,
  checkMessageData,
  languageNameData,
];

let automationInterfacePromise: Promise<AutomationInterface | undefined>;
const automationLifecycle = new AutomationRegistrationLifecycle();

/** Whether a load error says the optional automation interface package is not installed, and nothing else. */
export function isMissingAutomationInterface(error: ModuleLoadError): boolean {
  const firstLine = error.message.split("\n", 1)[0] ?? "";
  return (
    ["MODULE_NOT_FOUND", "ERR_MODULE_NOT_FOUND"].includes(error.code ?? "") &&
    (firstLine === `Cannot find module '${AUTOMATION_INTERFACE_PACKAGE}'` ||
      firstLine.startsWith(
        `Cannot find package '${AUTOMATION_INTERFACE_PACKAGE}' imported from `,
      ))
  );
}

async function loadAutomationInterface(): Promise<
  AutomationInterface | undefined
> {
  try {
    return await import("@antelopejs/interface-dms-automation");
  } catch (error) {
    if (error instanceof Error && isMissingAutomationInterface(error))
      return undefined;
    throw error;
  }
}

function getAutomationInterface(): Promise<AutomationInterface | undefined> {
  automationInterfacePromise ??= loadAutomationInterface();
  return automationInterfacePromise;
}

function collectErrors(operations: (() => void)[]): unknown[] {
  const errors: unknown[] = [];
  for (const operation of operations) {
    try {
      operation();
    } catch (error) {
      errors.push(error);
    }
  }
  return errors;
}

function cleanupAutomationNodes(automation: AutomationInterface): unknown[] {
  return collectErrors([
    ...LANG_TRIGGERS.map((trigger) => () => {
      automation.UnregisterTriggerType(trigger.id);
    }),
    ...LANG_ACTIONS.map((action) => () => {
      automation.UnregisterActionType(action.id);
    }),
    ...LANG_DATA_NODES.map((node) => () => {
      automation.UnregisterDataNodeType(node.id);
    }),
    clearLangChannels,
  ]);
}

/**
 * Declares the Lang automation node types when the optional automation
 * interface package is installed. Without a module implementing it, the
 * registrations are inert.
 */
export async function registerAutomationNodes(): Promise<void> {
  const automation = await getAutomationInterface();
  if (!automation || !automationLifecycle.beginRegistration()) return;
  try {
    for (const trigger of LANG_TRIGGERS)
      automation.RegisterTriggerType(trigger);
    for (const action of LANG_ACTIONS) automation.RegisterActionType(action);
    for (const node of LANG_DATA_NODES) automation.RegisterDataNodeType(node);
  } catch (error) {
    automationLifecycle.cleanup(() => cleanupAutomationNodes(automation));
    throw error;
  }
}

/** Withdraws the node types and drops every trigger subscription. */
export async function unregisterAutomationNodes(): Promise<void> {
  const automation = await getAutomationInterface();
  if (!automation || !automationLifecycle.isCleanupPending) {
    clearLangChannels();
    return;
  }
  const errors = automationLifecycle.cleanup(() =>
    cleanupAutomationNodes(automation),
  );
  if (errors.length > 0)
    throw new AggregateError(
      errors,
      "Failed to unregister Lang automation nodes",
    );
}
