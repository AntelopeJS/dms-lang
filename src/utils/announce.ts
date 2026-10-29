import {
  type RequestContext,
  SetParameterProvider,
} from "@antelopejs/interface-api";
import type { User } from "@antelopejs/interface-dms/auth/db";
import { PublishMessage } from "@antelopejs/interface-dms/realtime";
import { MakeParameterAndPropertyDecorator } from "@antelopejs/interface-core/decorators";
import { LANG_REALTIME_TOPIC } from "../pages/module";
import { isString } from "./guards";

/** The header the DMS frontend sends its realtime session id in, with every request. */
const SESSION_HEADER = "x-realtime-session";
const REALTIME_CHANGE = "changed";

/** A write to a workspace, as the open pages hear about it. */
export interface WorkspaceChange {
  workspace: string;
  /** Who wrote it. */
  actor: User;
  /** The realtime session of the tab that wrote it, which reads its own answer instead. */
  session?: string;
  /** The keys it changed, when it changed only keys: the pages read just those rows again. */
  keys?: string[];
}

/** The payload of a change on {@link LANG_REALTIME_TOPIC}. */
interface WorkspaceChangePayload extends Record<string, unknown> {
  workspace: string;
  session?: string;
  keys?: string[];
}

function sessionOf(context: RequestContext): string | undefined {
  const value = context.rawRequest.headers[SESSION_HEADER];
  return isString(value) && value !== "" ? value : undefined;
}

/** The realtime session of the tab sending the request, when it has one. */
export const RealtimeSession = MakeParameterAndPropertyDecorator(
  (target, key, index) => {
    SetParameterProvider(target, key, index, sessionOf);
  },
);

/**
 * Tells the open pages that a workspace changed: their blocks read their data
 * again, and the tab that wrote it, named by its session, skips its own echo.
 */
export function announce(change: WorkspaceChange): void {
  const payload: WorkspaceChangePayload = { workspace: change.workspace };
  if (change.session) payload.session = change.session;
  if (change.keys) payload.keys = change.keys;
  PublishMessage(LANG_REALTIME_TOPIC, REALTIME_CHANGE, {
    actorId: change.actor._id,
    payload,
  }).catch(() => undefined);
}
