import { isString } from "../../utils/guards";
import {
  isJsonObject,
  isJsonValue,
  type JsonObject,
  type JsonValue,
} from "../../utils/json";
import { SETUP_TOKEN } from "../setup-token";

/** The backend the harness serves the API on. */
export const API_ORIGIN = "http://127.0.0.1:5021";

/** The owner-only API the dashboard reads and writes through. */
export const LANG_API = "/api/lang/translations";

const OWNER_EMAIL = "owner@dms-lang.test";
const OWNER_PASSWORD = "Owner1!password";
const REQUEST_TIMEOUT_MS = 15_000;

/** What the backend answered: its status, headers and body, JSON when it parses as JSON and the text otherwise. */
export interface Answer {
  status: number;
  headers: Headers;
  body: JsonValue;
}

interface Request {
  method?: string;
  headers?: Record<string, string>;
  body?: JsonValue;
}

function parseBody(text: string): JsonValue {
  try {
    const parsed: unknown = JSON.parse(text);
    return isJsonValue(parsed) ? parsed : text;
  } catch {
    return text;
  }
}

/** One request to the backend; a JSON body is sent as JSON. */
export async function send(
  path: string,
  request: Request = {},
): Promise<Answer> {
  const headers = new Headers(request.headers);
  if (request.body !== undefined)
    headers.set("content-type", "application/json");
  const response = await fetch(`${API_ORIGIN}${path}`, {
    method: request.method ?? "GET",
    headers,
    body: request.body === undefined ? undefined : JSON.stringify(request.body),
    redirect: "manual",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  return {
    status: response.status,
    headers: response.headers,
    body: parseBody(await response.text()),
  };
}

/** The field of a JSON answer at `path`, or undefined when a step is not an object holding it. */
export function field(
  value: JsonValue | undefined,
  ...path: string[]
): JsonValue | undefined {
  let current = value;
  for (const step of path) {
    if (!isJsonObject(current)) return undefined;
    current = Object.hasOwn(current, step) ? current[step] : undefined;
  }
  return current;
}

/** The text at `path`, or an empty text when the field is not one. */
export function text(value: JsonValue | undefined, ...path: string[]): string {
  const found = field(value, ...path);
  return isString(found) ? found : "";
}

/** The objects of the array at `path`, none when the field is not an array. */
export function objects(
  value: JsonValue | undefined,
  ...path: string[]
): JsonObject[] {
  const found = field(value, ...path);
  return Array.isArray(found) ? found.filter(isJsonObject) : [];
}

let owner: Promise<string> | undefined;

async function registerOwner(): Promise<string> {
  const registered = await send("/api/onboarding/register", {
    method: "POST",
    body: {
      email: OWNER_EMAIL,
      password: OWNER_PASSWORD,
      firstName: "Test",
      lastName: "Owner",
      setupToken: SETUP_TOKEN,
      platformName: "dms-lang tests",
    },
  });
  if (registered.status < 200 || registered.status > 299)
    throw new Error(
      `onboarding the owner answered ${registered.status}: ${JSON.stringify(registered.body)}`,
    );
  const login = await send("/api/auth/login", {
    method: "POST",
    body: { email: OWNER_EMAIL, password: OWNER_PASSWORD },
  });
  const token = field(login.body, "access_token");
  if (!isString(token))
    throw new Error(
      `signing the owner in answered ${login.status}: ${JSON.stringify(login.body)}`,
    );
  return token;
}

/** The access token of the platform owner, onboarded once through the real registration route. */
export function ownerToken(): Promise<string> {
  owner ??= registerOwner();
  return owner;
}

/** A call to the Lang API as the platform owner. */
export async function lang(
  method: string,
  path: string,
  body?: JsonValue,
): Promise<Answer> {
  return send(`${LANG_API}${path}`, {
    method,
    headers: { authorization: `Bearer ${await ownerToken()}` },
    body,
  });
}

/** A call to the Lang API without a session. */
export function visitor(
  method: string,
  path: string,
  body?: JsonValue,
): Promise<Answer> {
  return send(`${LANG_API}${path}`, { method, body });
}

/** The status and the `code` of an error answer. */
export function failure(answer: Answer): [number, JsonValue | undefined] {
  return [answer.status, field(answer.body, "code")];
}
