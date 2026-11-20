import type { TriggerType } from "@antelopejs/interface-dms-automation";
import { findLocale } from "../../utils/locale-codes";
import {
  type CompletionEvent,
  completionChannel,
  LANG_OPERATIONS,
} from "../events";
import { LOCALE_PORT, WORKSPACE_PORT } from "../fields";
import { nodeTexts, objectSchema } from "../support";
import {
  ORIGIN_OUTPUTS,
  originFields,
  type TriggerHandle,
  watchedWorkspace,
} from "./shared";

const ID = "lang.language-completed";
const texts = nodeTexts("triggers", ID);

export interface LanguageCompletedConfig {
  workspace?: string;
  locale?: string;
}

function payloadOf(event: CompletionEvent) {
  return {
    deliveryId: `${event.change.writeId}:${event.locale}`,
    workspace: event.change.workspace,
    workspaceKind: event.change.workspaceKind,
    locale: event.locale,
    baseLocale: event.baseLocale,
    totalKeys: event.totalKeys,
    operation: event.change.operation,
    ...originFields(event.change),
  };
}

/**
 * Fires once per completion, whoever made the write: a completion is a
 * transition, which a procedure cannot repeat without undoing it first.
 */
export const languageCompletedTrigger: TriggerType<
  LanguageCompletedConfig,
  ReturnType<typeof payloadOf>,
  TriggerHandle
> = {
  id: ID,
  name: texts.name,
  description: texts.description,
  icon: "i-ph-seal-check",
  cluster: "replicated",
  configSchema: objectSchema({
    workspace: { ...WORKSPACE_PORT, description: texts.hint("workspace") },
    locale: { ...LOCALE_PORT, description: texts.hint("locale") },
  }),
  outputSchema: objectSchema(
    {
      deliveryId: { type: "string" },
      workspace: { type: "string" },
      workspaceKind: { type: "string", enum: ["default", "added"] },
      locale: { type: "string" },
      baseLocale: { type: "string" },
      totalKeys: { type: "number" },
      operation: { type: "string", enum: [...LANG_OPERATIONS] },
      ...ORIGIN_OUTPUTS,
    },
    [
      "deliveryId",
      "workspace",
      "workspaceKind",
      "locale",
      "baseLocale",
      "totalKeys",
      "operation",
      "origin",
      "at",
    ],
  ),
  async activate(config, emit) {
    const stop = completionChannel.subscribe((event) => {
      const workspace = watchedWorkspace(config.workspace);
      if (workspace !== "" && workspace !== event.change.workspace) return;
      const locale = config.locale?.trim() ?? "";
      if (locale !== "" && findLocale([event.locale], locale) === undefined)
        return;
      emit(payloadOf(event));
    });
    return { stop };
  },
  async deactivate(handle) {
    handle.stop();
  },
};
