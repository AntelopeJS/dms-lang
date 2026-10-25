import { antelopeFmtPreset } from "@antelopejs/tooling-configs/oxc/fmt";

/**
 * Prettier formats the Vue layer. dms-lang rewrites the locale files at run
 * time with tab indentation, so formatting them would fail every translation
 * edit.
 */
export default antelopeFmtPreset({
  ignorePatterns: [
    "frontend-vue/**",
    "**/*.md",
    "**/i18n/locales/*.json",
    "**/*.vue",
  ],
});
