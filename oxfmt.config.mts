import { antelopeFmtPreset } from "@antelopejs/tooling-configs/oxc/fmt";

export default antelopeFmtPreset({
  ignorePatterns: [
    "frontend-vue/**",
    "**/*.md",
    // dms-lang rewrites these at runtime with tab indentation, so formatting
    // them here would make every translation edit fail the format check.
    "**/i18n/locales/*.json",
    "**/*.vue",
  ],
});
