import { defineConfig } from "oxlint";
import {
  ANTELOPE_IGNORE_PATTERNS,
  antelopePreset,
} from "@antelopejs/tooling-configs/oxc/lint";

export default defineConfig({
  extends: [
    antelopePreset({
      // Turned on repository-wide with the import-sorting pass, so the
      // reordering lands as one reviewable change everywhere at once.
      importSorting: false,
    }),
  ],
  // Front-end sources, which oxlint cannot lint yet: they move with the
  // front-end migration.
  ignorePatterns: [...ANTELOPE_IGNORE_PATTERNS, "frontend-vue/**"],
  options: {
    typeAware: true,
    // Nothing left to report: the eight anti-slop rules tooling-configs
    // 0.0.4 leaves off accounted for the whole of the previous ceiling, so
    // this is zero by subtraction, not by repair. It never goes up, and a
    // single new warning fails CI. Here rather than in the lint script so
    // any direct oxlint run is held to it too; `lint:fix` opts out with
    // its own `--max-warnings`, since a fix pass is not a gate.
    maxWarnings: 0,
  },
});
