import { FALLBACK_LOCALE, findWorkspace } from "./catalog";
import { PROJECT_FILES } from "./constants";
import { languageOf } from "./locale-codes";
import { addedLocaleUrl, templateUrl } from "./public-url";
import type { WorkspaceKind } from "./workspaces";

export const SNIPPET_KINDS = ["vue", "i18next", "fetch", "curl"] as const;

export type SnippetKind = (typeof SNIPPET_KINDS)[number];

export interface Snippet {
  code: string;
  language: "javascript" | "shell" | "text";
}

interface SnippetInput {
  url: string;
  base: string;
  locales: string[];
}

/**
 * The workspace's codes and their languages: with `nonExplicitSupportedLngs`
 * i18next accepts `pt-BR` only when `pt` is listed too.
 */
function supportedLanguages(locales: string[]): string[] {
  const languages = locales.map(languageOf);
  return [...new Set([...locales, ...languages])].sort();
}

const FORMAT_NOTE = [
  "// Messages use the vue-i18n format: {name} placeholders, plurals written",
  "// \"one | many\" and a literal @ escaped as {'@'}.",
];

const SNIPPETS: Record<SnippetKind, (input: SnippetInput) => Snippet> = {
  vue: ({ url, base }) => ({
    language: "javascript",
    code: [
      'import { createI18n } from "vue-i18n";',
      "",
      `const base = "${base}";`,
      "const locale = navigator.language;",
      "const load = async (code) => {",
      `  const response = await fetch(\`${templateUrl(url, "${code}")}\`);`,
      "  return response.ok ? response.json() : {};",
      "};",
      "// A file leaves out the keys it has no text for: fr-BE falls back to fr,",
      "// then to the base, so all three are loaded.",
      'const codes = [...new Set([base, locale.split("-")[0], locale])];',
      "const messages = Object.fromEntries(",
      "  await Promise.all(codes.map(async (code) => [code, await load(code)])),",
      ");",
      "",
      "export const i18n = createI18n({",
      "  legacy: false,",
      "  locale,",
      "  fallbackLocale: base,",
      "  messages,",
      "});",
    ].join("\n"),
  }),
  i18next: ({ url, base, locales }) => ({
    language: "javascript",
    code: [
      'import i18next from "i18next";',
      'import HttpBackend from "i18next-http-backend";',
      "",
      ...FORMAT_NOTE,
      "// i18next reads the placeholders with the interpolation below; it does not",
      '// understand the "one | many" plurals.',
      "await i18next.use(HttpBackend).init({",
      "  lng: navigator.language,",
      `  fallbackLng: "${base}",`,
      `  supportedLngs: ${JSON.stringify(supportedLanguages(locales))},`,
      "  nonExplicitSupportedLngs: true,",
      '  interpolation: { prefix: "{", suffix: "}" },',
      "  // The load path takes the same {…} placeholders.",
      `  backend: { loadPath: "${templateUrl(url, "{lng}")}" },`,
      "});",
    ].join("\n"),
  }),
  fetch: ({ url, base }) => ({
    language: "javascript",
    code: [
      'const isObject = (value) => typeof value === "object" && value !== null;',
      "const merge = (target, source) => {",
      "  for (const [key, value] of Object.entries(source)) {",
      "    target[key] =",
      "      isObject(value) && isObject(target[key])",
      "        ? merge({ ...target[key] }, value)",
      "        : value;",
      "  }",
      "  return target;",
      "};",
      "",
      `async function loadMessages(locale = navigator.language, base = "${base}") {`,
      "  // A file leaves out the keys it has no text for: the base, then the",
      "  // language (fr), then the locale (fr-BE) fill them in, in that order.",
      '  const codes = [...new Set([base, locale.split("-")[0], locale])];',
      "  const files = await Promise.all(",
      "    codes.map(async (code) => {",
      `      const response = await fetch(\`${templateUrl(url, "${code}")}\`);`,
      "      return response.ok ? response.json() : {};",
      "    }),",
      "  );",
      "  return files.reduce(merge, {});",
      "}",
      "",
      "const messages = await loadMessages();",
    ].join("\n"),
  }),
  curl: ({ url, base }) => ({
    language: "shell",
    code: `curl ${templateUrl(url, base)}`,
  }),
};

const LOCAL_SNIPPETS: Record<Exclude<WorkspaceKind, "added">, string[]> = {
  default: [
    "// Not served at a public URL: the dashboard loads these keys itself",
    `// from ${PROJECT_FILES}. In a component of this dashboard:`,
    "const { t } = useI18n();",
    't("app.title");',
  ],
  modules: [
    "// Not served at a public URL: each module ships these keys and the",
    "// dashboard loads them itself. Override one in the project files",
    `// (${PROJECT_FILES}) to change it; in a component:`,
    "const { t } = useI18n();",
    't("dms.button.save");',
  ],
};

/** A ready-to-paste snippet loading the workspace in another app. */
export function workspaceSnippet(
  workspace: string,
  kind: SnippetKind,
  origin: string,
): Snippet {
  const summary = findWorkspace(workspace);
  if (summary.kind !== "added") {
    const local = LOCAL_SNIPPETS[summary.kind];
    return { language: "javascript", code: local.join("\n") };
  }
  const url = addedLocaleUrl(origin, summary.id);
  const build = SNIPPETS[kind];
  return build({
    url,
    base: summary.defaultLocale || FALLBACK_LOCALE,
    locales: summary.locales.map((locale) => locale.code),
  });
}
