import {
  ReadBody,
  type RequestContext,
  SetParameterProvider,
} from "@antelopejs/interface-api";
import { MakeParameterAndPropertyDecorator } from "@antelopejs/interface-core/decorators";
import { check, fail } from "./errors";
import { isJsonValue, type JsonValue } from "./json";

function parseJson(raw: Buffer): JsonValue {
  const text = raw.toString().trim();
  if (text === "") return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return fail("invalid_body", {}, "invalid_json");
  }
  check(isJsonValue(parsed), "invalid_body", {}, "invalid_json");
  return parsed;
}

/**
 * The parsed JSON body of a request, for its route schema to validate: a
 * malformed body answers 400 instead of the 500 of `JSONBody`.
 */
export const JsonBody = MakeParameterAndPropertyDecorator(
  (target, key, index) => {
    SetParameterProvider(target, key, index, (context: RequestContext) =>
      ReadBody(context).then(parseJson),
    );
  },
);
