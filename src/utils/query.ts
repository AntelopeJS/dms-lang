import type { QueryValue } from "@antelopejs/interface-api";

/** The text of a query parameter: one given without a value (`?name`, `?name=`) counts as absent. */
export function queryText(value: QueryValue): string | undefined {
  return value === true ? undefined : value;
}
