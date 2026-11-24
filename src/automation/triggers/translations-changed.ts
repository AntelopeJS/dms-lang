import type { TriggerType } from "@antelopejs/interface-dms-automation";
import { changeChannel, type LangChange, LANG_OPERATIONS } from "../events";
import { KEY_PREFIX_PORT, matchesPrefix, WORKSPACE_PORT } from "../fields";
import { nodeTexts, objectSchema } from "../support";
import {
  admits,
  capped,
  INCLUDE_AUTOMATION_WRITES,
  MAX_PAYLOAD_KEYS,
  ORIGIN_OUTPUTS,
  originFields,
  type TriggerHandle,
  watchedWorkspace,
} from "./shared";

const ID = "lang.translations-changed";
const texts = nodeTexts("triggers", ID);

export interface TranslationsChangedConfig {
  workspace?: string;
  operations?: string[];
  keyPrefix?: string;
  includeAutomationWrites?: boolean;
}

function matches(
  config: TranslationsChangedConfig,
  change: LangChange,
): boolean {
  const workspace = watchedWorkspace(config.workspace);
  if (
    workspace !== "" &&
    workspace !== change.workspace &&
    workspace !== change.previousWorkspace
  )
    return false;
  const operations = config.operations ?? [];
  if (operations.length > 0 && !operations.includes(change.operation))
    return false;
  const prefix = config.keyPrefix ?? "";
  return prefix === "" || change.keys.some((key) => matchesPrefix(key, prefix));
}

function payloadOf(change: LangChange) {
  const keys = capped(change.keys);
  return {
    deliveryId: change.writeId,
    workspace: change.workspace,
    workspaceKind: change.workspaceKind,
    operation: change.operation,
    keys: keys.items,
    keyCount: change.keys.length,
    keysTruncated: keys.truncated,
    previousKey: change.previousKey,
    previousWorkspace: change.previousWorkspace,
    locales: change.locales,
    ...originFields(change),
  };
}

export const translationsChangedTrigger: TriggerType<
  TranslationsChangedConfig,
  ReturnType<typeof payloadOf>,
  TriggerHandle
> = {
  id: ID,
  name: texts.name,
  description: texts.description,
  icon: "i-ph-translate",
  cluster: "replicated",
  configSchema: objectSchema({
    workspace: { ...WORKSPACE_PORT, description: texts.hint("workspace") },
    operations: {
      type: "array",
      items: { type: "string", enum: [...LANG_OPERATIONS] },
      maxItems: LANG_OPERATIONS.length,
      default: [],
      description: texts.hint("operations"),
    },
    keyPrefix: KEY_PREFIX_PORT,
    includeAutomationWrites: INCLUDE_AUTOMATION_WRITES,
  }),
  outputSchema: objectSchema(
    {
      deliveryId: { type: "string" },
      workspace: { type: "string" },
      workspaceKind: { type: "string", enum: ["default", "added"] },
      operation: { type: "string", enum: [...LANG_OPERATIONS] },
      keys: {
        type: "array",
        items: { type: "string" },
        maxItems: MAX_PAYLOAD_KEYS,
      },
      keyCount: { type: "number" },
      keysTruncated: { type: "boolean" },
      previousKey: { type: "string" },
      previousWorkspace: { type: "string" },
      locales: { type: "array", items: { type: "string" } },
      ...ORIGIN_OUTPUTS,
    },
    [
      "deliveryId",
      "workspace",
      "workspaceKind",
      "operation",
      "keys",
      "keyCount",
      "keysTruncated",
      "locales",
      "origin",
      "at",
    ],
  ),
  async activate(config, emit) {
    const stop = changeChannel.subscribe((change) => {
      if (!matches(config, change)) return;
      const subject =
        change.keys.length === 1 ? (change.keys[0] ?? "") : change.operation;
      if (!admits(ID, change, config.includeAutomationWrites, subject)) return;
      emit(payloadOf(change));
    });
    return { stop };
  },
  async deactivate(handle) {
    handle.stop();
  },
};
