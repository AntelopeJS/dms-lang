const path = require("node:path");
const { AddFrontendModule } = require("@antelopejs/interface-dms/page");

/** Registers the project's own frontend module, flagged as the writable application layer. */
async function construct() {
  await AddFrontendModule({
    name: "verify-app-frontend-vue",
    sourcePath: path.join(__dirname, "frontend-vue"),
    renderer: { name: "vue", version: "3" },
    configKey: "verifyApp",
    priority: 1,
    options: { dmsI18nAppLayer: true },
  });
}

async function start() {}

module.exports = { construct, start };
