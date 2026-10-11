import {
  ReadBody,
  type RequestContext,
  SetParameterProvider,
} from "@antelopejs/interface-api";
import { MakeParameterAndPropertyDecorator } from "@antelopejs/interface-core/decorators";
import { fail } from "./errors";

function parseJson(raw: Buffer): unknown {
  const text = raw.toString().trim();
  if (text === "") return {};
  try {
    return JSON.parse(text);
  } catch {
    return fail("invalid_body", {}, "invalid_json");
  }
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
