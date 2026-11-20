import { randomUUID } from "node:crypto";
import type {
  ActionType,
  ExecutionCtx,
  JsonObject,
  JsonValue,
  TriggerType,
} from "@antelopejs/interface-dms-automation";
import { getTranslationConfig, setTranslationConfig } from "../../utils/config";
import { isString } from "../../utils/guards";
import {
  isJsonObject,
  isJsonValue,
  type JsonObject as UtilJsonObject,
} from "../../utils/json";

/** The procedure a test step runs in. */
export const PROCEDURE_ID = "procedure-lang-test";

export function stepCtx(dryRun = false): ExecutionCtx {
  return {
    procedureId: PROCEDURE_ID,
    runId: `run-${randomUUID()}`,
    nodeId: "node-1",
    dryRun,
    log: () => undefined,
  };
}

/** Runs an action as a procedure step does: its dry run in a test run, `execute` otherwise. */
export async function step(
  action: ActionType<JsonObject, JsonObject>,
  input: JsonObject,
  dryRun = false,
): Promise<JsonObject> {
  if (dryRun) {
    if (!action.dryRun) throw new Error(`${action.id} has no dry run`);
    return action.dryRun(input, stepCtx(true));
  }
  return action.execute(input, stepCtx());
}

/** The message `work` fails with, or `"no failure"` when it succeeds. */
export async function failureOf(work: Promise<unknown>): Promise<string> {
  try {
    await work;
    return "no failure";
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

/** What an armed trigger received, its handle, and how to disarm it. */
export interface Capture<TPayload, THandle> {
  received: TPayload[];
  handle: THandle;
  stop: () => Promise<void>;
}

/** Arms `trigger` with `config` and keeps every payload it emits. */
export async function capture<TConfig, TPayload extends JsonValue, THandle>(
  trigger: TriggerType<TConfig, TPayload, THandle>,
  config: TConfig,
): Promise<Capture<TPayload, THandle>> {
  const received: TPayload[] = [];
  const handle = await trigger.activate(config, (payload) => {
    received.push(payload);
  });
  return { received, handle, stop: () => trigger.deactivate(handle) };
}

/** Runs `work` with Lang editing switched to `editable`, then switches it back. */
export async function withEditable<T>(
  editable: boolean,
  work: () => Promise<T>,
): Promise<T> {
  const previous = getTranslationConfig();
  setTranslationConfig({ ...previous, editable });
  try {
    return await work();
  } finally {
    setTranslationConfig(previous);
  }
}

/** The object at `field` of a step's output; a test that expects one fails loudly on anything else. */
export function objectField(output: JsonObject, field: string): UtilJsonObject {
  const value: unknown = output[field];
  if (isJsonValue(value) && isJsonObject(value)) return value;
  throw new TypeError(`${field} is not an object`);
}

/** The text at `field` of a step's output, or an empty text when it is not one. */
export function textField(output: JsonObject, field: string): string {
  const value = output[field];
  return isString(value) ? value : "";
}

/** The objects of the list at `field` of a step's output. */
export function objectsField(
  output: JsonObject,
  field: string,
): UtilJsonObject[] {
  const value: unknown = output[field];
  if (!isJsonValue(value) || !Array.isArray(value)) return [];
  return value.filter(isJsonObject);
}
