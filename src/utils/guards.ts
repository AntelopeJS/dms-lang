/** Whether a value is a string. */
export function isString(value: unknown): value is string {
  return typeof value === "string";
}

/** Whether a value is a number or a boolean: a value `String` prints as itself. */
export function isNumberOrBoolean(value: unknown): value is number | boolean {
  return typeof value === "number" || typeof value === "boolean";
}

/** Whether a value is an object, an array included, and not `null`. */
export function isObject(value: unknown): value is object {
  return typeof value === "object" && value !== null;
}
