import { antelopeKnipConfig } from "@antelopejs/tooling-configs/knip";

const knipConfig = antelopeKnipConfig({
  // The harness is loaded by `ajs module test`, not imported, and it is what
  // pulls in the in-memory Mongo.
  entry: ["src/test/harness.ts"],
});

knipConfig.ignoreUnresolved = ["#dms/frontend-module", "#dms/frontend-build"];
knipConfig.workspaces = {
  "frontend-vue": {
    entry: ["dms.frontend.ts", "dms.frontend.build.ts"],
    project: ["app/**/*.{ts,vue}", "dms.frontend.ts"],
  },
};

export default knipConfig;
