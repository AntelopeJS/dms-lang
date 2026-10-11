import type { RequestContext } from "@antelopejs/interface-api";
import type { KeyValueListItem } from "@antelopejs/interface-dms/base/key-value-list";
import type { BlockItems } from "./blocks";
import { FALLBACK_LOCALE, findWorkspace } from "./catalog";
import { LANG_TEXTS, PROJECT_FILES, PUBLIC_PATH } from "./constants";
import { resolveFlat } from "./resolve";
import type { WorkspaceKind, WorkspaceSummary } from "./workspaces";

const LOCALE_TOKEN = "{locale}";
const FORWARDED_SEPARATOR = ",";

function firstHeader(
  context: RequestContext,
  name: string,
): string | undefined {
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
  return `${origin}${PUBLIC_PATH}/${workspace.id}/${locale}.json`;
}

/** A URL template with its `{locale}` written as `token`. */
export function templateUrl(url: string, token: string): string {
  return url.replace(LOCALE_TOKEN, token);
}

const LOCAL_ENDPOINTS: Record<
  Exclude<WorkspaceKind, "added">,
  KeyValueListItem[]
> = {
  default: [
    {
      id: "source",
      label: `$${LANG_TEXTS}.endpoint.source_title`,
      value: PROJECT_FILES,
      type: "mono",
      copy: true,
    },
    {
      id: "loading",
      label: `$${LANG_TEXTS}.endpoint.loading`,
      value: { key: `${LANG_TEXTS}.endpoint.loading_default` },
    },
  ],
  modules: [
    {
      id: "source",
      label: `$${LANG_TEXTS}.endpoint.source_title`,
      value: { key: `${LANG_TEXTS}.workspace_kinds.modules.files` },
    },
    {
      id: "loading",
      label: `$${LANG_TEXTS}.endpoint.loading`,
      value: { key: `${LANG_TEXTS}.endpoint.loading_modules` },
    },
  ],
};

function publicEndpoint(url: string, base: string): KeyValueListItem[] {
  const example = templateUrl(url, base);
  return [
    { id: "url", label: "GET", value: url, type: "mono", copy: true },
    {
      id: "example",
      label: `$${LANG_TEXTS}.endpoint.example`,
      value: example,
      type: "mono",
      copy: true,
    },
    {
      id: "fallback",
      label: `$${LANG_TEXTS}.endpoint.fallback`,
      value: { key: `${LANG_TEXTS}.endpoint.fallback_note` },
    },
    {
      id: "access",
      label: `$${LANG_TEXTS}.endpoint.access`,
      value: { key: `${LANG_TEXTS}.endpoint.note` },
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
