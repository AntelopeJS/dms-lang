import { antelopeKnipConfig } from "@antelopejs/tooling-configs/knip";

const knipConfig = antelopeKnipConfig({
  /**
   * The harness is loaded by `ajs module test`, not imported, and it is what
   * pulls in the in-memory Mongo.
   */
  entry: ["src/test/harness.ts"],
  ignore: [".amp/**"],
  /**
   * The frontend tests import Vue and Vite as the installed renderer
   * resolves them (tests/helpers/frontend-runtime.mjs,
   * tests/backend-boundary.test.mjs), not from the root.
   */
  ignoreDependencies: ["vue", "vite"],
});

/** `#dms-ui/*` is the DMS UI layer, aliased by the frontend build like `#dms/*`. */
knipConfig.ignoreUnresolved = [
  "#dms/frontend-module",
  "#dms/frontend-build",
  /^#dms-ui\//,
];
/**
 * The DMS loads the frontend without imports knip can follow: the components
 * through the `import.meta.glob` of dms.frontend.ts, and the composables,
 * utils and types through the auto-imports dms.frontend.build.ts registers.
 * They are entries, so their exports only count as used inside the module
 * when a file imports them by path.
 */
knipConfig.workspaces = {
  "frontend-vue": {
    entry: [
      "app/{components,build/components}/**/*.vue",
      "app/{composables,utils,types,config}/**/*.ts",
    ],
    project: ["app/**/*.{ts,vue}"],
  },
};

export default knipConfig;
