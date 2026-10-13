import { requireAction } from "./component-action";
import { TRANSLATION_ACTIONS, translationMatrix } from "./translations";
import {
  WORKSPACE_ACTIONS,
  workspaceDangerZone,
  workspaceGeneral,
} from "./workspace";
import { WORKSPACE_LIST_ACTIONS, workspaceList } from "./workspaces";

export const editTranslationsAction = requireAction(
  translationMatrix,
  TRANSLATION_ACTIONS.edit,
);

export const manageKeysAction = requireAction(
  translationMatrix,
  TRANSLATION_ACTIONS.keys,
);

export const createWorkspaceAction = requireAction(
  workspaceList,
  WORKSPACE_LIST_ACTIONS.create,
);

export const editWorkspaceAction = requireAction(
  workspaceGeneral,
  WORKSPACE_ACTIONS.edit,
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
