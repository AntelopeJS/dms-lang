import type { RequestContext } from "@antelopejs/interface-api";
import { GetApiBaseUrl } from "@antelopejs/interface-dms/api-base-url";
import type { KeyValueListItem } from "@antelopejs/interface-dms/base/key-value-list";
import type { BlockItems } from "./blocks";
import { FALLBACK_LOCALE, findWorkspace } from "./catalog";
import { LANG_TEXTS, PROJECT_FILES, PUBLIC_PATH } from "./constants";
import type { WorkspaceKind, WorkspaceSummary } from "./workspaces";

const LOCALE_TOKEN = "{locale}";
const TRAILING_SLASHES_RE = /\/+$/;

/**
 * The public origin of the backend, the one base every public URL is built
 * on: the DMS `apiBaseUrl` (the dev server's origin in development). A DMS
 * configured without one gives none; the origin the request reached the
 * backend on stands in, right whenever no reverse proxy sits in front of it.
 */
export async function publicOrigin(context: RequestContext): Promise<string> {
  const configured = await GetApiBaseUrl();
  if (configured) return configured.replace(TRAILING_SLASHES_RE, "");
  return context.url.origin;
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
  return {
    items: publicEndpoint(url, summary.defaultLocale || FALLBACK_LOCALE),
  };
}
