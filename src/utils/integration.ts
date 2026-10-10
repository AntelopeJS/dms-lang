import { FALLBACK_LOCALE, listAllWorkspaces } from "./catalog";
import { nativeName, publicLocaleUrl } from "./languages";
import { isRowMissing, resolveFlat } from "./resolve";
import type { BlockItems, KeyValueItem } from "./blocks";

const TEXTS = "dms_lang";
const LOCALE_TOKEN = "{locale}";
const PROJECT_FILES = "frontend-vue/i18n/locales/app-*.json";

export type SnippetKind = "i18next" | "fetch" | "curl";

export interface Snippet {
  code: string;
  language: "javascript" | "shell" | "text";
}

const SNIPPETS: Record<SnippetKind, (url: string, base: string) => Snippet> = {
  i18next: (url, base) => ({
    language: "javascript",
    code: [
      'import HttpBackend from "i18next-http-backend";',
      "",
      "i18next.use(HttpBackend).init({",
      `  fallbackLng: "${base}",`,
      `  backend: { loadPath: "${url.replace(LOCALE_TOKEN, "{{lng}}")}" },`,
      "});",
    ].join("\n"),
  }),
  fetch: (url, base) => ({
    language: "javascript",
    code: [
      `const locale = navigator.language || "${base}";`,
      `const response = await fetch(\`${url.replace(LOCALE_TOKEN, "${locale}")}\`);`,
      "const messages = await response.json();",
    ].join("\n"),
  }),
  curl: (url, base) => ({
    language: "shell",
    code: `curl ${url.replace(LOCALE_TOKEN, base)}`,
  }),
};

function kindOf(workspace: string): string | undefined {
  return listAllWorkspaces().find((entry) => entry.id === workspace)?.kind;
}

/** The public URL of a workspace and how to reach it, as key / value rows. */
export async function workspaceEndpoint(
  workspace: string,
): Promise<BlockItems<KeyValueItem>> {
  const kind = kindOf(workspace);
  if (kind !== "added") {
    const source =
      kind === "default"
        ? PROJECT_FILES
        : `$${TEXTS}.workspace_kinds.modules.source`;
    return {
      items: [
        {
          id: "source",
          label: `$${TEXTS}.endpoint.source_title`,
          value: source,
          type: kind === "default" ? "mono" : "text",
          copy: kind === "default",
        },
      ],
    };
  }
  return {
    items: [
      {
        id: "url",
        label: "GET",
        value: `/i18n/${workspace}/{locale}.json`,
        type: "mono",
        copyValue: await publicLocaleUrl(workspace),
      },
      {
        id: "access",
        label: `$${TEXTS}.endpoint.access`,
        value: `$${TEXTS}.endpoint.note`,
      },
    ],
  };
}

/** A ready-to-paste snippet loading the workspace in another app. */
export async function workspaceSnippet(
  workspace: string,
  kind: SnippetKind,
): Promise<Snippet> {
  const base =
    resolveFlat(workspace, FALLBACK_LOCALE).defaultLocale || FALLBACK_LOCALE;
  const build = SNIPPETS[kind] ?? SNIPPETS.i18next;
  return build(await publicLocaleUrl(workspace), base);
}

/** The dialog confirming the removal of a language, worded by the server. */
export async function removalConfirm(workspace: string, code: string) {
  const flat = resolveFlat(workspace, FALLBACK_LOCALE);
  const strings = flat.rows.filter((row) => !isRowMissing(row, code)).length;
  return {
    title: `$${TEXTS}.language_remove.title`,
    description: `$${TEXTS}.language_remove.description`,
    params: {
      name: nativeName(code),
      workspace,
      url: await publicLocaleUrl(workspace, code),
      file: `${code}.json`,
    },
    color: "error",
    confirmLabel: `$${TEXTS}.language_remove.submit`,
    confirmText: code,
    impact: [
      { icon: "i-ph-file", label: `$${TEXTS}.language_remove.file` },
      {
        icon: "i-ph-text-aa",
        label: `$${TEXTS}.language_remove.strings`,
        count: strings,
      },
    ],
  };
}
