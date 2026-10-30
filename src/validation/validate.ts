import { assertValidation } from "@antelopejs/interface-api-util";
import { ZodError, type ZodType, type ZodTypeDef } from "zod";
import { errorBody, errorMessage, errorStatus } from "../utils/errors";

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
    ...errorBody(INVALID_BODY, { issues: error.issues }),
    message: firstMessage(error),
  };
}

/** The input of a route parsed by its schema, or 400 `invalid_body` with the issues. */
export function validate<Output, Input>(
  schema: ZodType<Output, ZodTypeDef, Input>,
  input: unknown,
): Output {
  return assertValidation(
    input,
    (value) => schema.parse(value),
    (error) =>
      error instanceof ZodError ? refusal(error) : errorBody(INVALID_BODY),
    errorStatus(INVALID_BODY),
  );
}
