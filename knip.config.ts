import { antelopeKnipConfig } from "@antelopejs/tooling-configs/knip";

const knipConfig = antelopeKnipConfig({
  // The harness is loaded by `ajs module test`, not imported, and it is what
  // pulls in the in-memory Mongo.
  entry: ["src/test/harness.ts"],
});

knipConfig.ignoreUnresolved = ["#dms/frontend-module"];
knipConfig.workspaces = {
  "frontend-vue": {
    entry: ["dms.frontend.ts"],
    project: ["app/**/*.{ts,vue}", "dms.frontend.ts"],
    // Knip excludes build directories before applying project globs.
    ignoreDependencies: ["@vueuse/core"],
  },
};

export default knipConfig;
