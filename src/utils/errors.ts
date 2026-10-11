import { HTTPResult } from "@antelopejs/interface-api";

export type ErrorCode =
  | "invalid_body"
  | "invalid_key_path"
  | "invalid_value"
  | "invalid_message"
  | "invalid_locale"
  | "unknown_locale"
  | "invalid_workspace_id"
  | "reserved_workspace"
  | "not_a_key"
  | "read_only"
  | "unknown_workspace"
  | "key_not_found"
  | "not_an_override"
  | "conflict"
  | "key_exists"
  | "key_conflict"
  | "module_key"
  | "last_value"
  | "workspace_exists"
  | "locale_exists"
  | "base_locale"
  | "server_error";

export type ErrorDetails = Record<string, unknown>;

/** Throws a JSON error `{ message, code, ...details }`: the message is readable and never names a disk path. */
export function fail(
  status: number,
  code: ErrorCode,
  message: string,
  details: ErrorDetails = {},
): never {
  throw new HTTPResult(status, { ...details, message, code });
}

/** {@link fail} unless `condition` holds. */
export function check(
  condition: unknown,
  status: number,
  code: ErrorCode,
  message: string,
  details?: ErrorDetails,
): asserts condition {
  if (!condition) fail(status, code, message, details);
}
