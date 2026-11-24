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

const MAX_REMEMBERED_VERDICTS = 1000;
const breakerVerdicts = new Map<string, boolean>();

/**
 * The circuit breaker's verdict on one change for one trigger type, asked
 * once per change: every activation of the trigger shares it, so the number
 * of procedures listening does not change when the breaker trips.
 */
function breakerAdmits(
  triggerId: string,
  change: LangChange,
  subject: string,
): boolean {
  const id = `${triggerId}|${change.writeId}`;
  const known = breakerVerdicts.get(id);
  if (known !== undefined) return known;
  if (breakerVerdicts.size >= MAX_REMEMBERED_VERDICTS) {
    const oldest = breakerVerdicts.keys().next().value;
    if (oldest !== undefined) breakerVerdicts.delete(oldest);
  }
  const verdict = admitAutomationEvent(
    triggerId,
    `${change.workspace}|${subject}`,
  );
  breakerVerdicts.set(id, verdict);
  return verdict;
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
  return breakerAdmits(triggerId, change, subject);
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
