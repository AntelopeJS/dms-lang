import type {
  BannerContent,
  BannerTone,
} from "@antelopejs/interface-dms/base/banner";
import type { BlockLinkAction } from "@antelopejs/interface-dms/base/display";
import { PAGE_ACTION_QUERY, PAGE_ACTIONS } from "../pages/quick-actions";
import { findWorkspace } from "./catalog";
import { LANG_TEXTS, PAGES_URL } from "./constants";
import { type FlatResult, resolveFlat } from "./resolve";
import type { WorkspaceKind, WorkspaceSummary } from "./workspaces";

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
    title: `$${LANG_TEXTS}.notice.${name}_title`,
    description: `$${LANG_TEXTS}.notice.${name}_description`,
    actions,
  };
}

function addLanguageLink(workspace: string): BlockLinkAction {
  return {
    label: `$${LANG_TEXTS}.languages.add`,
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
        label: `$${LANG_TEXTS}.notice.browse_keys`,
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
