import {
  ReadBody,
  type RequestContext,
  SetParameterProvider,
} from "@antelopejs/interface-api";
import { MakeParameterAndPropertyDecorator } from "@antelopejs/interface-core/decorators";
import { check, fail } from "./errors";

function parseObject(raw: Buffer): Record<string, unknown> {
  const text = raw.toString().trim();
  if (text === "") return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    fail(400, "invalid_body", "Invalid JSON body");
  }
  check(
    parsed !== null && typeof parsed === "object" && !Array.isArray(parsed),
    400,
    "invalid_body",
    "The request body must be a JSON object",
  );
  return parsed as Record<string, unknown>;
}

/** The JSON object body of a request: a malformed body answers 400 instead of 500. */
export const JsonObjectBody = MakeParameterAndPropertyDecorator(
  (target, key, index) => {
    SetParameterProvider(target, key, index, (context: RequestContext) =>
      ReadBody(context).then(parseObject),
    );
  },
);

/** A required string field of a body, or 400. */
export function requireString(value: unknown, field: string): string {
  check(
    typeof value === "string" && value.trim() !== "",
    400,
    "invalid_body",
    `Missing field: ${field}`,
  );
  return value;
}
