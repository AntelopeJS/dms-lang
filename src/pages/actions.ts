import type { Action, Component } from "@antelopejs/interface-dms/component";
import {
  LangTranslationsController,
  TRANSLATION_ACTIONS,
} from "./translations";
import {
  WORKSPACE_ACTIONS,
  workspaceDangerZone,
  workspaceGeneral,
} from "./workspace";
import { LangWorkspacesController, WORKSPACE_LIST_ACTIONS } from "./workspaces";

function requireAction(component: Component, id: string): Action {
  const action = component.getAction(id);
  if (!action) throw new Error(`dms-lang: missing component action "${id}"`);
  return action;
}

export const editTranslationsAction = requireAction(
  LangTranslationsController.matrix,
  TRANSLATION_ACTIONS.edit,
);

export const manageKeysAction = requireAction(
  LangTranslationsController.matrix,
  TRANSLATION_ACTIONS.keys,
);

export const createWorkspaceAction = requireAction(
  LangWorkspacesController.list,
  WORKSPACE_LIST_ACTIONS.create,
);

export const manageLanguagesAction = requireAction(
  workspaceGeneral,
  WORKSPACE_ACTIONS.languages,
);

export const renameWorkspaceAction = requireAction(
  workspaceDangerZone,
  WORKSPACE_ACTIONS.rename,
);

export const deleteWorkspaceAction = requireAction(
  workspaceDangerZone,
  WORKSPACE_ACTIONS.delete,
);
