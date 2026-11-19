import type { JourneysConfig } from "@antelopejs/dms/e2e";

export default {
  playground: "e2e/playground",
  prepare: [
    [
      "pnpm",
      "install",
      "--frozen-lockfile",
      "--prefer-offline",
      "--ignore-scripts",
    ],
    ["pnpm", "run", "build"],
    [
      "ln",
      "-sfn",
      "../../playground/node_modules",
      "e2e/playground/node_modules",
    ],
  ],
  smoke: "smoke",
} satisfies JourneysConfig;
