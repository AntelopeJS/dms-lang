import { antelopeFmtPreset } from "@antelopejs/tooling-configs/oxc/fmt";

/**
 * Prettier formats the Vue layer. dms-lang rewrites the locale files at run
 * time with tab indentation, so formatting them would fail every translation
 * edit. The journeys, their helpers, the e2e playground and the key-writes
 * check keep the layout they had in the verify skills.
 */
export default antelopeFmtPreset({
  ignorePatterns: [
    "frontend-vue/**",
    "**/*.md",
    "**/i18n/locales/*.json",
    "**/*.vue",
    "e2e/journeys/**",
    "e2e/*.mjs",
    "e2e/playground/**",
    "tests/key-writes/**",
  ],
});
