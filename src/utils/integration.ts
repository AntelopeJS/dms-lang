import type { RequestContext } from "@antelopejs/interface-api";
import { PAGE_ACTION_QUERY, PAGE_ACTIONS } from "../pages/quick-actions";
import type {
  BannerContent,
  BannerTone,
} from "@antelopejs/interface-dms/base/banner";
import { serializeConfirmDialog } from "@antelopejs/interface-dms/base/confirm-dialog";
import type { BlockLinkAction } from "@antelopejs/interface-dms/base/display";
import type { KeyValueListItem } from "@antelopejs/interface-dms/base/key-value-list";
import type {
  ConfirmDialog,
  ConfirmDialogImpact,
  ConfirmDialogSerialized,
} from "@antelopejs/interface-dms/base/types";
import type { BlockItems } from "./blocks";
import { FALLBACK_LOCALE, findWorkspace } from "./catalog";
import { fail } from "./errors";
import { nativeName } from "./languages";
import { findLocale, languageOf } from "./locale-codes";
import { type FlatResult, isRowMissing, resolveFlat } from "./resolve";
import type { WorkspaceKind, WorkspaceSummary } from "./workspaces";

const TEXTS = "dms_lang";
const LOCALE_TOKEN = "{locale}";
const PUBLIC_PREFIX = "/i18n";
const PROJECT_FILES = "frontend-vue/i18n/locales/app-*.json";
const FORWARDED_SEPARATOR = ",";
const LISTED_KEYS = 20;
const SHOWN_KEYS = 5;

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

function firstHeader(context: RequestContext, name: string) {
  const value = context.rawRequest.headers[name];
  const header = Array.isArray(value) ? value[0] : value;
  return header?.split(FORWARDED_SEPARATOR)[0]?.trim() || undefined;
}

/**
 * The public origin of the backend, as the request reached it: a reverse
 * proxy's `X-Forwarded-Proto` / `X-Forwarded-Host` first, then the `Host` the
 * dashboard's own server calls it on. The one base every public URL is built on.
 */
export function publicOrigin(context: RequestContext): string {
  const socket = context.rawRequest.socket as { encrypted?: boolean };
  const protocol =
    firstHeader(context, "x-forwarded-proto") ??
    (socket.encrypted ? "https" : "http");
  const host =
    firstHeader(context, "x-forwarded-host") ??
    firstHeader(context, "host") ??
    context.url.host;
  return `${protocol}://${host}`;
}

/** What decides whether a workspace is served publicly, and under which id. */
export type PublicWorkspace = Pick<WorkspaceSummary, "id" | "kind">;

/**
 * The public URL of a language of an added workspace (`{locale}` by default:
 * the template). Undefined for the project files and the modules, which the
 * public endpoint does not serve.
 */
export function publicLocaleUrl(
  origin: string,
  workspace: PublicWorkspace,
  locale = LOCALE_TOKEN,
): string | undefined {
  if (workspace.kind !== "added") return undefined;
  return `${origin}${PUBLIC_PREFIX}/${workspace.id}/${locale}.json`;
}

function templateUrl(url: string, token: string): string {
  return url.replace(LOCALE_TOKEN, token);
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
  const url = publicLocaleUrl(origin, summary);
  if (summary.kind !== "added" || !url) {
    const local = LOCAL_SNIPPETS[summary.kind as keyof typeof LOCAL_SNIPPETS];
    return { language: "javascript", code: local.join("\n") };
  }
  const flat = resolveFlat(summary.id);
  const build = SNIPPETS[kind];
  return build({
    url,
    base: flat.defaultLocale || FALLBACK_LOCALE,
    locales: flat.locales,
  });
}

const LOCAL_ENDPOINTS: Record<
  Exclude<WorkspaceKind, "added">,
  KeyValueListItem[]
> = {
  default: [
    {
      id: "source",
      label: `$${TEXTS}.endpoint.source_title`,
      value: PROJECT_FILES,
      type: "mono",
      copy: true,
    },
    {
      id: "loading",
      label: `$${TEXTS}.endpoint.loading`,
      value: { key: `${TEXTS}.endpoint.loading_default` },
    },
  ],
  modules: [
    {
      id: "source",
      label: `$${TEXTS}.endpoint.source_title`,
      value: { key: `${TEXTS}.workspace_kinds.modules.files` },
    },
    {
      id: "loading",
      label: `$${TEXTS}.endpoint.loading`,
      value: { key: `${TEXTS}.endpoint.loading_modules` },
    },
  ],
};

function publicEndpoint(url: string, base: string): KeyValueListItem[] {
  const example = templateUrl(url, base);
  return [
    { id: "url", label: "GET", value: url, type: "mono", copy: true },
    {
      id: "example",
      label: `$${TEXTS}.endpoint.example`,
      value: example,
      type: "mono",
      copy: true,
    },
    {
      id: "fallback",
      label: `$${TEXTS}.endpoint.fallback`,
      value: { key: `${TEXTS}.endpoint.fallback_note` },
    },
    {
      id: "access",
      label: `$${TEXTS}.endpoint.access`,
      value: { key: `${TEXTS}.endpoint.note` },
    },
  ];
}

/** The public URL of a workspace and how to reach it, as key / value rows. */
export function workspaceEndpoint(
  workspace: string,
  origin: string,
): BlockItems<KeyValueListItem> {
  const summary = findWorkspace(workspace);
  const url = publicLocaleUrl(origin, summary);
  if (summary.kind !== "added" || !url) {
    return {
      items: LOCAL_ENDPOINTS[summary.kind as keyof typeof LOCAL_ENDPOINTS],
    };
  }
  const base = resolveFlat(summary.id).defaultLocale;
  return { items: publicEndpoint(url, base || FALLBACK_LOCALE) };
}

/** The dialog confirming a new base language, with what a caller wording its own dialog needs. */
export interface BaseConfirm extends ConfirmDialogSerialized {
  missing: number;
  keys: string[];
}

/** The workspace's own code for `code`, matched on its canonical form; 404 when it has no such language. */
function knownLocale(flat: FlatResult, code: string): string {
  const found = findLocale(flat.locales, code);
  if (found === undefined) fail("unknown_locale", { locale: code });
  return found;
}

function countStrings(flat: FlatResult, code: string): number {
  return flat.rows.filter((row) => !isRowMissing(row, code)).length;
}

/**
 * The dialog confirming the removal of a language, worded by the server: the
 * code to type only when texts would be lost, and where to save them first.
 */
export function removalConfirm(
  workspace: string,
  requested: string,
  origin: string,
): ConfirmDialogSerialized {
  const summary = findWorkspace(workspace);
  const flat = resolveFlat(summary.id);
  const code = knownLocale(flat, requested);
  const strings = countStrings(flat, code);
  const impact: ConfirmDialogImpact[] = [
    { icon: "i-ph-file", label: `$${TEXTS}.language_remove.file` },
  ];
  const dialog: ConfirmDialog = {
    title: `$${TEXTS}.language_remove.title`,
    description: `$${TEXTS}.language_remove.description`,
    params: {
      name: nativeName(code, flat.locales),
      workspace: summary.id,
      url: publicLocaleUrl(origin, summary, code) ?? "",
      file: `${code}.json`,
    },
    color: "error",
    confirmLabel: `$${TEXTS}.language_remove.submit`,
    impact,
  };
  if (!strings) return serializeConfirmDialog(dialog);
  dialog.description = `$${TEXTS}.language_remove.description_backup`;
  dialog.confirmText = code;
  impact.push({
    icon: "i-ph-text-aa",
    label: `$${TEXTS}.language_remove.strings`,
    count: strings,
  });
  return serializeConfirmDialog(dialog);
}

function keyImpact(keys: string[], missing: number): ConfirmDialogImpact[] {
  const shown = keys
    .slice(0, SHOWN_KEYS)
    .map((key) => ({ icon: "i-ph-key", label: key }));
  const rest = missing - shown.length;
  return rest > 0
    ? [
        ...shown,
        {
          icon: "i-ph-dots-three",
          label: `$${TEXTS}.language_base.more_keys`,
          count: rest,
        },
      ]
    : shown;
}

/**
 * The dialog confirming a new base language: the keys that have no text in
 * it (then missing in the base), with their count and the first of them
 * (`missing`, `keys`) for a caller that words its own dialog.
 */
export function baseConfirm(workspace: string, requested: string): BaseConfirm {
  const flat = resolveFlat(findWorkspace(workspace).id);
  const code = knownLocale(flat, requested);
  const missingRows = flat.rows.filter((row) => isRowMissing(row, code));
  const keys = missingRows.slice(0, LISTED_KEYS).map((row) => row.key);
  const missing = missingRows.length;
  const dialog = serializeConfirmDialog({
    title: `$${TEXTS}.language_base.confirm_title`,
    description: missing
      ? `$${TEXTS}.language_base.confirm_missing`
      : `$${TEXTS}.language_base.confirm_complete`,
    params: { name: nativeName(code, flat.locales), count: missing },
    icon: "i-ph-star",
    color: "primary",
    confirmLabel: `$${TEXTS}.language_base.confirm_submit`,
    impact: keyImpact(keys, missing),
  });
  return { ...dialog, missing, keys };
}

const PAGES_URL = "/modules/lang";

export const NOTICE_PAGES = ["overview", "workspace"] as const;

export type NoticePage = (typeof NOTICE_PAGES)[number];

interface NoticeState {
  summary: WorkspaceSummary;
  flat: FlatResult;
  page: NoticePage;
}

function pageUrl(page: string, workspace: string, action?: string): string {
  const query = new URLSearchParams({ workspace });
  if (action) query.set(PAGE_ACTION_QUERY, action);
  return `${PAGES_URL}/${page}?${query.toString()}`;
}

function notice(
  name: string,
  tone: BannerTone,
  icon: string,
  actions: BlockLinkAction[] = [],
): BannerContent {
  return {
    tone,
    icon,
    title: `$${TEXTS}.notice.${name}_title`,
    description: `$${TEXTS}.notice.${name}_description`,
    actions,
  };
}

function addLanguageLink(workspace: string): BlockLinkAction {
  return {
    label: `$${TEXTS}.languages.add`,
    to: pageUrl("overview", workspace, PAGE_ACTIONS.addLanguage),
    icon: "i-ph-plus",
    color: "primary",
    variant: "solid",
  };
}

function addedNotice({ summary, flat, page }: NoticeState): BannerContent {
  if (page === "workspace") return notice("keys", "info", "i-ph-info");
  if (flat.totalKeys === 0 || flat.locales.length > 1) return {};
  const actions = summary.editable ? [addLanguageLink(summary.id)] : [];
  return notice("no_target", "info", "i-ph-translate", actions);
}

const KIND_NOTICES: Record<
  WorkspaceKind,
  (state: NoticeState) => BannerContent
> = {
  added: addedNotice,
  default: () => ({}),
  modules: () =>
    notice("modules", "warning", "i-ph-puzzle-piece", [
      {
        label: `$${TEXTS}.notice.browse_keys`,
        to: pageUrl("translations", "modules"),
        icon: "i-ph-table",
        color: "neutral",
        variant: "outline",
      },
    ]),
};

/**
 * The banner a page of the workspace opens with, or `{}` for none: what the
 * modules keys are, the first steps of an empty workspace, how keys are
 * shared between languages.
 */
export function workspaceNotice(
  workspace: string,
  page: NoticePage,
): BannerContent {
  const summary = findWorkspace(workspace);
  const flat = resolveFlat(summary.id);
  return KIND_NOTICES[summary.kind]({ summary, flat, page });
}
