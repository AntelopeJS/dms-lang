import { type HTTPBody, HTTPResult } from "@antelopejs/interface-api";
import type { LocaleTexts } from "./keys";
import type { MessageIssue } from "./message-syntax";

const BAD_REQUEST = 400;
const FORBIDDEN = 403;
const NOT_FOUND = 404;
const CONFLICT = 409;
const SERVER_ERROR = 500;

/** The HTTP status of each error code: the code alone decides it. */
const ERROR_STATUS = {
  invalid_body: BAD_REQUEST,
  invalid_key_path: BAD_REQUEST,
  invalid_value: BAD_REQUEST,
  invalid_message: BAD_REQUEST,
  invalid_locale: BAD_REQUEST,
  undeclared_locale: BAD_REQUEST,
  invalid_workspace_id: BAD_REQUEST,
  reserved_workspace: BAD_REQUEST,
  not_a_key: BAD_REQUEST,
  read_only: FORBIDDEN,
  unknown_workspace: NOT_FOUND,
  unknown_locale: NOT_FOUND,
  key_not_found: NOT_FOUND,
  not_an_override: NOT_FOUND,
  conflict: CONFLICT,
  key_exists: CONFLICT,
  key_conflict: CONFLICT,
  module_key: CONFLICT,
  last_value: CONFLICT,
  workspace_exists: CONFLICT,
  locale_exists: CONFLICT,
  base_locale: CONFLICT,
  server_error: SERVER_ERROR,
} as const satisfies Record<string, number>;

export type ErrorCode = keyof typeof ERROR_STATUS;

/**
 * Why a request failed when the code alone does not say it: the last
 * segment of its `$dms_lang.errors.*` message key.
 */
export type ErrorReason =
  | ErrorCode
  | "invalid_json"
  | "invalid_new_key_path"
  | "same_key_path"
  | "invalid_before"
  | "empty_key"
  | "module_key_locked"
  | "modules_read_only"
  | "review_added_only"
  | "no_project_file"
  | "duplicate_locale"
  | "unknown_base_locale"
  | "no_locale"
  | "corrupt_file"
  | "corrupt_manifest"
  | "invalid_backup"
  | "newer_backup"
  | "not_configured";

/** A value an error names for the client to act on it. */
type ErrorDetail =
  | string
  | number
  | undefined
  | string[]
  | LocaleTexts
  | MessageIssue[]
  | HTTPBody;

export type ErrorDetails = Record<string, ErrorDetail>;

/** The JSON body of an error: an i18n message key, a stable code and what the client needs to act on it. */
export type ErrorBody = ErrorDetails & {
  message: string;
  code: ErrorCode;
};

const MESSAGE_PREFIX = "$dms_lang.errors";

/** The `$dms_lang.errors.*` key of a reason: the message the DMS frontend translates. */
export function errorMessage(reason: ErrorReason): string {
  return `${MESSAGE_PREFIX}.${reason}`;
}

export function errorStatus(code: ErrorCode): number {
  return Object.hasOwn(ERROR_STATUS, code)
    ? ERROR_STATUS[code]
    : ERROR_STATUS.server_error;
}

export function errorBody(
  code: ErrorCode,
  details: ErrorDetails = {},
  reason: ErrorReason = code,
): ErrorBody {
  return { ...details, message: errorMessage(reason), code };
}

/** The error response of a code, for a handler that answers it instead of throwing it. */
export function errorResult(
  code: ErrorCode,
  details?: ErrorDetails,
  reason?: ErrorReason,
): HTTPResult {
  return new HTTPResult(errorStatus(code), errorBody(code, details, reason));
}

/**
 * Throws a JSON error `{ message, code, ...details }`: `message` is the
 * `$dms_lang.errors.<reason>` key and never names a disk path, the status
 * follows the code.
 */
export function fail(
  code: ErrorCode,
  details?: ErrorDetails,
  reason?: ErrorReason,
): never {
  throw errorResult(code, details, reason);
}

/** {@link fail} unless `condition` holds. */
export function check(
  condition: unknown,
  code: ErrorCode,
  details?: ErrorDetails,
  reason?: ErrorReason,
): asserts condition {
  if (!condition) fail(code, details, reason);
}
