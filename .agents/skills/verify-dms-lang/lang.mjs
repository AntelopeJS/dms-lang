import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * @typedef {import("../../../node_modules/@antelopejs/dms/bin/control/journey.mjs").JourneyContext} Ctx
 * @typedef {import("../../../node_modules/@antelopejs/dms/bin/control/tab.mjs").Tab} Tab
 * @typedef {{ status: number | null, body: unknown, error: string | null, folder?: string }} Answer
 * @typedef {{ folder: string, status: number | null, headers: Record<string, string>, text: string, json: unknown }} Raw
 * @typedef {Record<string, unknown>} Row
 */

/**
 * @param {unknown} value Anything a JSON answer holds
 * @returns {value is Row} Whether it is an object
 */
export function isRow(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Reads a nested field of a JSON answer.
 *
 * @param {unknown} value The answer
 * @param {...string} path The field names, outermost first
 * @returns {unknown} The field, or undefined when a step is missing
 */
export function pick(value, ...path) {
  let current = value;
  for (const step of path) {
    if (!isRow(current)) return undefined;
    current = current[step];
  }
  return current;
}

/**
 * @param {unknown} value A JSON answer
 * @returns {Row} The answer when it is an object, else an empty object
 */
export function toRow(value) {
  return isRow(value) ? value : {};
}

/**
 * The objects of an array field of a JSON answer.
 *
 * @param {unknown} value The answer
 * @param {...string} path The field names, outermost first
 * @returns {Row[]} The array's objects, empty when the field is not an array
 */
export function list(value, ...path) {
  const found = pick(value, ...path);
  return Array.isArray(found) ? found.filter(isRow) : [];
}

/** The owner-only HTTP API the dashboard reads and writes through. */
export const LANG = "/api/lang/translations";

/** The messages of the project files the playground ships, by locale file. */
export const PROJECT_FILES = {
  "app-en-GB.json": { shop: { title: "Shop", pay: "Pay {price}", cancel: "Cancel order", total: "Total {amount}" }, auth: { login: "Sign in" } },
  "app-fr-FR.json": { shop: { title: "Boutique", pay: "Payer {price}", total: "Total {montant}" }, auth: { login: "Connexion" } },
};

/**
 * @param {Ctx} ctx The journey
 * @param {string} label What the call does
 * @param {string} method The HTTP method
 * @param {string} path The path under the Lang API
 * @param {unknown} [body] The JSON body
 * @returns {Promise<Answer>} The answer
 */
export function lang(ctx, label, method, path, body) {
  return ctx.api(label, { method, path: `${LANG}${path}`, body });
}

/**
 * A request with its response headers kept in the evidence, to the backend (`api`) or the dashboard origin (`web`).
 *
 * @param {Ctx} ctx The journey
 * @param {string} label What the request does
 * @param {{ path: string, origin?: "api" | "web", method?: string, headers?: Record<string, string> }} request What to send
 * @returns {Promise<Raw>} The answer
 */
export async function raw(ctx, label, request) {
  const folder = ctx.step(label);
  const origin = request.origin === "web" ? ctx.state.webUrl : ctx.state.apiUrl;
  const method = request.method ?? "GET";
  const headers = request.headers ?? {};
  const recorded = headers.cookie === undefined ? headers : { ...headers, cookie: "the dashboard session" };
  writeFileSync(join(folder, "request.json"), `${JSON.stringify({ method, url: `${origin}${request.path}`, headers: recorded }, null, 2)}\n`);
  const response = await fetch(`${origin}${request.path}`, { method, headers, redirect: "manual" });
  const text = await response.text();
  /** @type {Record<string, string>} */
  const received = {};
  for (const [name, value] of response.headers) received[name] = value;
  const json = parseJson(text);
  writeFileSync(join(folder, "response.json"), `${JSON.stringify({ status: response.status, headers: received, body: text }, null, 2)}\n`);
  return { folder, status: response.status, headers: received, text, json };
}

/**
 * @param {string} text A response body
 * @returns {unknown} Its JSON value, or undefined when it is not JSON
 */
export function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/**
 * Records checks against the evidence folder `raw` made.
 *
 * @param {Ctx} ctx The journey
 * @param {Raw} answer The answer
 * @param {{ name: string, pass: boolean, detail: string }[]} checks The checks
 * @returns {boolean} Whether they all passed
 */
export function recordRaw(ctx, answer, checks) {
  return ctx.record(answer.folder, checks);
}

/**
 * Where the created workspaces are stored for this run.
 *
 * @param {Ctx} ctx The journey
 * @param {string} [id] A workspace
 * @returns {string} The folder
 */
export function workspacesDir(ctx, id) {
  const root = join(ctx.state.home, "dms-lang-workspaces");
  return id === undefined ? root : join(root, id);
}

/**
 * @param {Ctx} ctx The journey
 * @param {string} id The workspace
 * @param {string} locale The locale file
 * @returns {unknown} The parsed file
 */
export function readLocaleFile(ctx, id, locale) {
  return readJsonFile(join(workspacesDir(ctx, id), `${locale}.json`));
}

/**
 * @param {string} file A JSON file
 * @returns {unknown} Its parsed content
 */
export function readJsonFile(file) {
  return parseJson(readFileSync(file, "utf8"));
}

/**
 * @param {Ctx} ctx The journey
 * @param {string} id The workspace
 * @returns {string[]} The names in its folder, sorted
 */
export function workspaceFiles(ctx, id) {
  try {
    return readdirSync(workspacesDir(ctx, id)).sort();
  } catch {
    return [];
  }
}

/**
 * Creates a workspace through the API and adds the locales and keys given.
 *
 * @param {Ctx} ctx The journey
 * @param {string} id The workspace id
 * @param {{ locales?: string[], keys?: Record<string, Record<string, string>> }} [content] The base language is the first locale
 * @returns {Promise<Answer>} The create answer
 */
export async function seedWorkspace(ctx, id, content = {}) {
  const locales = content.locales ?? ["en"];
  const created = await lang(ctx, `create ${id}`, "POST", "/workspace", { id, locale: { code: locales[0] } });
  for (const code of locales.slice(1)) await lang(ctx, `add ${code} to ${id}`, "POST", "/locale", { workspace: id, code });
  for (const [path, values] of Object.entries(content.keys ?? {})) {
    await lang(ctx, `create ${path}`, "POST", "/key", { workspace: id, path, values });
  }
  return created;
}

/**
 * A workspace id no earlier journey of the run used.
 *
 * @param {Ctx} ctx The journey
 * @param {string} prefix The start of the id
 * @returns {string} The id
 */
export function freshId(ctx, prefix) {
  return ctx.unique(prefix).toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

/**
 * Puts the project files back as the playground ships them and removes any other locale file, so a journey starts from the same project.
 *
 * @param {Ctx} ctx The journey
 */
export function resetProjectFiles(ctx) {
  const folder = join(ctx.state.runPlayground ?? "", "frontend-vue", "i18n", "locales");
  rmSync(folder, { recursive: true, force: true });
  mkdirSync(folder, { recursive: true });
  for (const [name, messages] of Object.entries(PROJECT_FILES)) {
    writeFileSync(join(folder, name), `${JSON.stringify(messages, null, 2)}\n`);
  }
}

/**
 * @param {Ctx} ctx The journey
 * @returns {string} The folder of the project's locale files in this run's playground copy
 */
export function projectLocalesDir(ctx) {
  return join(ctx.state.runPlayground ?? "", "frontend-vue", "i18n", "locales");
}

/**
 * The value of a form field, or undefined when the field is not on the page, so a check on it fails instead of
 * ending the journey without a failing check.
 *
 * @param {Tab} tab The tab
 * @param {{ role: string, name: string | RegExp }} target The field
 * @returns {Promise<string | undefined>} Its value
 */
export async function fieldValue(tab, target) {
  try {
    return String(await tab.value(target));
  } catch {
    return undefined;
  }
}

/**
 * Clicks until what the click opens shows. The pages render on the server and a click that lands before they
 * hydrate does nothing, so the click is repeated, at most five times, while what it opens has not appeared.
 *
 * @param {Tab} tab The tab
 * @param {{ role: string, name: string | RegExp, exact?: boolean }} target What to click
 * @param {{ role: string, name?: string | RegExp }} opened What the click opens
 * @returns {Promise<void>}
 */
export async function clickUntil(tab, target, opened) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await tab.click(target);
    const shown = await tab.visible(opened, { timeoutMs: 3000 });
    if (shown.pass) return;
  }
}

/**
 * Signs the administrator in on the dashboard's origin the way the hydrated sign-in form does, and returns the
 * session cookies, so a journey reads a page as the frontend server renders it, before any script runs.
 *
 * @param {Ctx} ctx The journey
 * @returns {Promise<string>} The `cookie` header of the session
 */
export async function dashboardSession(ctx) {
  const folder = ctx.step("sign in on the dashboard origin");
  const credentials = ctx.state.accounts?.admin;
  const url = `${ctx.state.webUrl}/auth/login`;
  writeFileSync(join(folder, "request.json"), `${JSON.stringify({ method: "POST", url, email: credentials?.email }, null, 2)}\n`);
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", origin: ctx.state.webUrl },
    body: JSON.stringify({ email: credentials?.email, password: credentials?.password }),
  });
  const cookies = response.headers.getSetCookie().map((cookie) => cookie.split(";")[0] ?? "");
  const names = cookies.map((cookie) => cookie.split("=")[0]);
  writeFileSync(join(folder, "response.json"), `${JSON.stringify({ status: response.status, cookies: names }, null, 2)}\n`);
  ctx.record(folder, [{ name: "the dashboard opens a session", pass: response.ok && names.some((name) => name?.startsWith("dms_session")), detail: `${response.status} ${names.join(", ")}` }], { critical: true });
  return cookies.join("; ");
}

/**
 * The page props the frontend server rendered into a page, read from the HTML it sent.
 *
 * @param {string} html The page
 * @returns {string | undefined} The URL the page says it is at
 */
export function renderedUrl(html) {
  const match = /"url":"((?:[^"\\]|\\.)*)","version"/.exec(html);
  return match?.[1]?.replaceAll("\\/", "/");
}

/**
 * Asks the playground's app module, while the backend runs, to register frontend modules again
 * (`playground/index.cjs`), and waits until `accept` sees the change through the API.
 *
 * @param {Ctx} ctx The journey
 * @param {"app-unflagged" | "app-flagged" | "late-installed" | "late-app-layer"} wanted The registration
 * @param {() => Promise<Answer>} read One read of the API
 * @param {(answer: Answer) => boolean} accept Whether the answer shows the new registration
 * @returns {Promise<Answer>} The last answer
 */
export function reregister(ctx, wanted, read, accept) {
  writeFileSync(join(ctx.state.home, "verify-frontend-modules.txt"), `${wanted}\n`);
  return eventually(read, accept, 20_000);
}

/**
 * Removes the registrations file, so a later write of it is a change the playground sees.
 *
 * @param {Ctx} ctx The journey
 */
export function forgetRegistrations(ctx) {
  rmSync(join(ctx.state.home, "verify-frontend-modules.txt"), { force: true });
}

/**
 * Reads until an answer is accepted or the time is up, for a change the dashboard saves a moment after the click.
 *
 * @param {() => Promise<Answer>} read One read of the API
 * @param {(answer: Answer) => boolean} accept Whether the answer shows the change
 * @param {number} [timeoutMs] How long to wait
 * @returns {Promise<Answer>} The last answer
 */
export async function eventually(read, accept, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  let answer = await read();
  while (!accept(answer) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    answer = await read();
  }
  return answer;
}

const GONE = /signs in and leaves \/auth|ECONNREFUSED|ECONNRESET|fetch failed|socket hang up|Target closed|has been closed|browser has disconnected|terminated/i;

/**
 * Whether the run's backend and dashboard still answer, probed synchronously so any recorded step can be judged.
 *
 * @param {Ctx} ctx The journey
 * @returns {boolean} False when either is gone
 */
function environmentUp(ctx) {
  for (const url of [`${ctx.state.apiUrl}/api/onboarding/informations`, `${ctx.state.webUrl}/dms-preview`]) {
    const probe = spawnSync("curl", ["-fsS", "-m", "5", "-o", "/dev/null", url], { encoding: "utf8" });
    if (probe.status !== 0) return false;
  }
  return true;
}

const SHOW_PASSWORD = { role: "button", name: "Show password" };
const HIDE_PASSWORD = { role: "button", name: "Hide password" };
const HYDRATION_ATTEMPTS = 20;
const HYDRATION_POLL_MS = 1500;
const SIGN_IN_TIMEOUT_MS = 60_000;

/**
 * Waits until the sign-in form is interactive. The server renders it as a plain `<form method="post">` and the
 * dashboard hydrates it after the page's `load` event: a Login click before that posts the form to `/auth`, which
 * answers `{"message":"Not found"}` and leaves the page on `/auth`. The Show password toggle only works once the
 * form is hydrated, so the button becoming Hide password proves it.
 *
 * @param {Tab} tab The tab on the sign-in page
 * @returns {Promise<boolean>} Whether the form became interactive
 */
async function waitForHydration(tab) {
  for (let attempt = 0; attempt < HYDRATION_ATTEMPTS; attempt += 1) {
    await tab.click(SHOW_PASSWORD);
    const toggled = await tab.visible(HIDE_PASSWORD, { timeoutMs: HYDRATION_POLL_MS });
    if (toggled.pass) return true;
  }
  return false;
}

/**
 * Signs an account in through the sign-in form once the form is hydrated, and records the same critical check as
 * the harness's own sign-in.
 *
 * @param {Ctx} ctx The journey
 * @param {Tab} tab The tab to sign in
 * @param {string} account The account of the journey
 * @returns {Promise<void>}
 */
async function signInHydrated(ctx, tab, account) {
  const credentials = ctx.state.accounts?.[account];
  if (!credentials) {
    ctx.record(ctx.step(`${tab.label} signed in as ${account}`), [{ name: `${account} signs in and leaves /auth`, pass: false, detail: `no account ${account}` }], { critical: true });
    return;
  }
  await tab.goto("/auth");
  await waitForHydration(tab);
  await tab.fill({ role: "textbox", name: "Email address" }, credentials.email);
  await tab.fill({ role: "textbox", name: "Password", exact: true }, credentials.password);
  await tab.click({ role: "button", name: "Login", exact: true });
  const left = await tab.at(/^(?!\/auth)/, { timeoutMs: SIGN_IN_TIMEOUT_MS });
  ctx.record(ctx.step(`${tab.label} signed in as ${account}`), [{ name: `${account} signs in and leaves /auth`, pass: left.pass === true, detail: String(left.detail) }], { critical: true });
}

/**
 * Makes a check that fails because the environment went away NOT VERIFIED: before a step with a failing check is
 * recorded, the backend and the dashboard are probed, and when one is gone the journey ends with an error and no
 * failing check, which `seeded` does not count as a catch.
 *
 * @template {{ run: (ctx: Ctx) => Promise<void> }} Journey
 * @param {Journey[]} journeys The journeys of a feature
 * @returns {Journey[]} The same journeys with the guard installed
 */
export function guarded(journeys) {
  return journeys.map((journey) => ({
    ...journey,
    async run(/** @type {Ctx} */ ctx) {
      const openTab = ctx.tab.bind(ctx);
      ctx.tab = async (account, label) => {
        const tab = await openTab(account, label);
        tab.signIn = (/** @type {string} */ who) => signInHydrated(ctx, tab, who);
        return tab;
      };
      const record = ctx.record.bind(ctx);
      ctx.record = (folder, checks, options) => {
        const failing = checks.filter((check) => !check.pass);
        if (failing.length > 0 && (failing.some((check) => GONE.test(`${check.name} ${check.detail}`)) || !environmentUp(ctx))) {
          throw new Error(`NOT VERIFIED: the environment went away (${failing[0]?.detail.slice(0, 200)})`);
        }
        return record(folder, checks, options);
      };
      const verify = ctx.verify.bind(ctx);
      ctx.verify = async (label, checks, options) => {
        const results = await Promise.all(checks.map((check) => Promise.resolve(check)));
        if (results.some((check) => !check.pass) && !environmentUp(ctx)) {
          throw new Error(`NOT VERIFIED: the environment went away before "${label}" could be judged`);
        }
        return verify(label, results, options);
      };
      await journey.run(ctx);
    },
  }));
}
