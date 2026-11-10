import { HTTPResult } from "@antelopejs/interface-api";
import type { ZodError } from "zod";
import { errorBody, errorMessage, errorStatus } from "../utils/errors";
import { zodIssuesJson } from "../utils/zod-json";

const KEY_PREFIX = "$";
const INVALID_BODY = "invalid_body";

function firstMessage(error: ZodError): string {
  const message = error.issues[0]?.message;
  return message?.startsWith(KEY_PREFIX) ? message : errorMessage(INVALID_BODY);
}

/**
 * The body of an input zod refused, in the DMS format: the first issue's
 * `$dms_lang.errors.*` key (a generic one when zod worded it), the stable
 * `invalid_body` code and the zod `issues` the DMS `useFieldErrors` reads.
 */
function refusal(error: ZodError) {
  return {
    ...errorBody(INVALID_BODY, { issues: zodIssuesJson(error.issues) }),
    message: firstMessage(error),
  };
}

/** What a zod `safeParse` returns: the parsed value, or the error that refused the input. */
type Parsed<Output> =
  | { success: true; data: Output }
  | { success: false; error: ZodError };

/** The value a route's schema parsed, or 400 `invalid_body` with the issues. */
export function validated<Output>(result: Parsed<Output>): Output {
  if (result.success) {
    return result.data;
  }
  throw new HTTPResult(errorStatus(INVALID_BODY), refusal(result.error));
}
