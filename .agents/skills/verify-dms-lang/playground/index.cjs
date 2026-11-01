const fs = require("node:fs");
const path = require("node:path");
const { AddFrontendModule } = require("@antelopejs/interface-dms/page");
const { SubscribeMessage } = require("@antelopejs/interface-dms/realtime");

const RENDERER = { name: "vue", version: "3" };

/**
 * The file a journey writes while the backend runs to register frontend modules again. It holds one word:
 * `app-unflagged` or `app-flagged` registers the project's module without or with `dmsI18nAppLayer`, and
 * `late-installed` or `late-app-layer` registers a second module, at priority 0, that the backend did not know at
 * start. A restarted backend starts from the shipped registration whatever the file holds.
 */
const REGISTRATIONS = path.join(process.env.HOME ?? ".", "verify-frontend-modules.txt");

/** The topic the docs tell a module of its own to subscribe to. */
const TRANSLATIONS_TOPIC = "dms-lang.translations";

/** One JSON line per message the backend hears on {@link TRANSLATIONS_TOPIC}, as a third-party subscriber would. */
const HEARD = path.join(process.env.HOME ?? ".", "verify-realtime-heard.jsonl");

/**
 * @param {boolean} appLayer Whether the project's module is flagged as the writable application layer
 * @returns {Promise<void>}
 */
function registerApp(appLayer) {
  return AddFrontendModule({
    name: "verify-app-frontend-vue",
    sourcePath: path.join(__dirname, "frontend-vue"),
    renderer: RENDERER,
    configKey: "verifyApp",
    priority: 1,
    options: { dmsI18nAppLayer: appLayer },
  });
}

/**
 * @param {boolean} appLayer Whether the late module is flagged as an application layer
 * @returns {Promise<void>}
 */
function registerLate(appLayer) {
  return AddFrontendModule({
    name: "verify-late-frontend-vue",
    sourcePath: path.join(__dirname, "late-frontend-vue"),
    renderer: RENDERER,
    configKey: "verifyLate",
    priority: 0,
    options: { dmsI18nAppLayer: appLayer },
  });
}

/** Applies the registration the file names; a missing file or another word asks for nothing. */
function applyRegistrations() {
  let wanted = "";
  try {
    wanted = fs.readFileSync(REGISTRATIONS, "utf8").trim();
  } catch {
    return;
  }
  if (wanted === "app-unflagged" || wanted === "app-flagged") void registerApp(wanted === "app-flagged");
  if (wanted === "late-installed" || wanted === "late-app-layer") void registerLate(wanted === "late-app-layer");
}

/** Registers the project's own frontend module, flagged as the writable application layer. */
async function construct() {
  await registerApp(true);
  SubscribeMessage(TRANSLATIONS_TOPIC, (message) => {
    fs.appendFile(HEARD, `${JSON.stringify({ topic: message.topic, type: message.type, payload: message.payload })}\n`, () => undefined);
  });
}

async function start() {
  fs.watchFile(REGISTRATIONS, { interval: 250 }, applyRegistrations);
}

async function stop() {
  fs.unwatchFile(REGISTRATIONS, applyRegistrations);
}

module.exports = { construct, start, stop };
