import type { JsonSchema } from "@antelopejs/interface-dms-automation";
import type { ChangeOrigin, LangChange } from "../events";
import { admitAutomationEvent } from "../loop-guard";
import { normalizeWorkspaceId } from "../../utils/workspaces";

export const MAX_PAYLOAD_KEYS = 500;

/** A handle of an armed trigger: what `deactivate` stops. */
export interface TriggerHandle {
  stop(): void;
}

export const ORIGIN_OUTPUTS = {
  origin: { type: "string", enum: ["user", "automation"] },
  originProcedureId: { type: "string" },
  originRunId: { type: "string" },
  actorId: { type: "string" },
  at: { type: "string", format: "date-time" },
} satisfies Record<string, JsonSchema>;

export const INCLUDE_AUTOMATION_WRITES: JsonSchema = {
  type: "boolean",
  default: false,
  description: "$dms_lang.automation.hints.includeAutomationWrites",
};

/** Who wrote a change, and when. */
export type OriginFields = ChangeOrigin & { at: string };

/** The origin fields of a payload: who wrote, and when. */
export function originFields(change: LangChange): OriginFields {
  return { ...change.origin, at: change.at };
}

/** The translation workspace a trigger watches, normalized; empty watches every one. */
export function watchedWorkspace(workspace: string | undefined): string {
  return normalizeWorkspaceId(workspace);
}

/**
 * Whether a change may reach a trigger: a write made by a procedure only with
 * `includeAutomationWrites`, and then only while the circuit breaker admits it.
 */
export function admits(
  triggerId: string,
  change: LangChange,
  includeAutomationWrites: boolean | undefined,
  subject: string,
): boolean {
  if (change.origin.origin !== "automation") return true;
  if (includeAutomationWrites !== true) return false;
  return admitAutomationEvent(triggerId, `${change.workspace}|${subject}`);
}

/** A list capped for a payload, and whether it lost items. */
export interface CappedList {
  items: string[];
  truncated: boolean;
}

export function capped(items: string[]): CappedList {
  return {
    items: items.slice(0, MAX_PAYLOAD_KEYS),
    truncated: items.length > MAX_PAYLOAD_KEYS,
  };
}
