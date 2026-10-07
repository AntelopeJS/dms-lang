import {
  QuickAction,
  QuickActionCategory,
} from "@antelopejs/interface-dms/quick-actions";
import { LangOverviewController } from "./overview";
import { LangTranslationsController } from "./translations";
import { LangWorkspacesController } from "./workspaces";

export const PAGE_ACTION_QUERY = "action";

export const PAGE_ACTIONS = {
  addLanguage: "add-language",
  addKey: "add-key",
  newWorkspace: "new-workspace",
} as const;

const category = QuickActionCategory("dms-lang", {
  displayName: "$dms_lang.title",
  icon: "i-ph-translate",
});

QuickAction("lang-translate-missing", {
  category,
  displayName: "$dms_lang.quick_actions.translate_missing",
  icon: "i-ph-translate",
  order: 0,
  target: {
    type: "navigate",
    page: LangTranslationsController,
    query: { filter: "missing" },
  },
});

QuickAction("lang-add-key", {
  category,
  displayName: "$dms_lang.quick_actions.add_key",
  icon: "i-ph-key",
  order: 1,
  target: {
    type: "navigate",
    page: LangTranslationsController,
    query: { [PAGE_ACTION_QUERY]: PAGE_ACTIONS.addKey },
  },
});

QuickAction("lang-add-language", {
  category,
  displayName: "$dms_lang.quick_actions.add_language",
  icon: "i-ph-plus",
  order: 2,
  target: {
    type: "navigate",
    page: LangOverviewController,
    query: { [PAGE_ACTION_QUERY]: PAGE_ACTIONS.addLanguage },
  },
});

QuickAction("lang-new-workspace", {
  category,
  displayName: "$dms_lang.quick_actions.new_workspace",
  icon: "i-ph-stack",
  order: 3,
  target: {
    type: "navigate",
    page: LangWorkspacesController,
    query: { [PAGE_ACTION_QUERY]: PAGE_ACTIONS.newWorkspace },
  },
});
