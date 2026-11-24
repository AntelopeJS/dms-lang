import type { TriggerType } from "@antelopejs/interface-dms-automation";
import { type BaseTextEvent, baseTextChannel } from "../events";
import { KEY_PREFIX_PORT, matchesPrefix, WORKSPACE_PORT } from "../fields";
import { nodeTexts, objectSchema } from "../support";
import {
  admits,
  INCLUDE_AUTOMATION_WRITES,
  ORIGIN_OUTPUTS,
  originFields,
  type TriggerHandle,
  watchedWorkspace,
} from "./shared";

const ID = "lang.base-text-changed";
const texts = nodeTexts("triggers", ID);

export interface BaseTextChangedConfig {
  workspace?: string;
  keyPrefix?: string;
  includeAutomationWrites?: boolean;
}

function payloadOf(event: BaseTextEvent) {
  return {
    deliveryId: event.change.writeId,
    workspace: event.change.workspace,
    workspaceKind: event.change.workspaceKind,
    key: event.key,
    baseLocale: event.baseLocale,
    previousText: event.previousText,
    text: event.text,
    removed: event.text === "",
    staleLocales: event.staleLocales,
    ...originFields(event.change),
  };
}

export const baseTextChangedTrigger: TriggerType<
  BaseTextChangedConfig,
  ReturnType<typeof payloadOf>,
  TriggerHandle
> = {
  id: ID,
  name: texts.name,
  description: texts.description,
  icon: "i-ph-note-pencil",
  cluster: "replicated",
  configSchema: objectSchema({
    workspace: { ...WORKSPACE_PORT, description: texts.hint("workspace") },
    keyPrefix: KEY_PREFIX_PORT,
    includeAutomationWrites: INCLUDE_AUTOMATION_WRITES,
  }),
  outputSchema: objectSchema(
    {
      deliveryId: { type: "string" },
      workspace: { type: "string" },
      workspaceKind: { type: "string", enum: ["default", "added"] },
      key: { type: "string" },
      baseLocale: { type: "string" },
      previousText: { type: "string" },
      text: { type: "string" },
      removed: { type: "boolean" },
      staleLocales: { type: "array", items: { type: "string" } },
      ...ORIGIN_OUTPUTS,
    },
    [
      "deliveryId",
      "workspace",
      "workspaceKind",
      "key",
      "baseLocale",
      "previousText",
      "text",
      "removed",
      "staleLocales",
      "origin",
      "at",
    ],
  ),
  async activate(config, emit) {
    const stop = baseTextChannel.subscribe((event) => {
      const workspace = watchedWorkspace(config.workspace);
      if (workspace !== "" && workspace !== event.change.workspace) return;
      if (!matchesPrefix(event.key, config.keyPrefix ?? "")) return;
      if (!admits(ID, event.change, config.includeAutomationWrites, event.key))
        return;
      emit(payloadOf(event));
    });
    return { stop };
  },
  async deactivate(handle) {
    handle.stop();
  },
};
