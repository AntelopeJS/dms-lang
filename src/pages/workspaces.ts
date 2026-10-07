import { CustomComponent } from "@antelopejs/interface-dms/base/custom";
import { StatGroup } from "@antelopejs/interface-dms/base/stat-group";
import { PageController, RegisterPage } from "@antelopejs/interface-dms/page";
import { LANG_MODULE_ID, manageCategory } from "./module";
import { PERMISSION_TEXTS } from "./texts";

const TEXTS = `${PERMISSION_TEXTS}.workspaces`;
const KINDS = "$dms_lang.workspaces.kinds";

export const WORKSPACE_LIST_ACTIONS = {
  create: "create",
} as const;

@RegisterPage()
export class LangWorkspacesController extends PageController("workspaces", {
  displayName: "$dms_lang.workspaces.title",
  description: "$dms_lang.workspaces.description",
  module: LANG_MODULE_ID,
  category: manageCategory,
  icon: "i-ph-stack",
  order: 0,
}) {
  static kinds = StatGroup({
    layout: "joined",
    label: `${KINDS}.label`,
    items: [
      {
        id: "default",
        icon: "i-ph-file-code",
        tone: "primary",
        eyebrow: `${KINDS}.default_eyebrow`,
        value: `${KINDS}.default_title`,
        detail: `${KINDS}.default_detail`,
      },
      {
        id: "added",
        icon: "i-ph-stack",
        tone: "primary",
        eyebrow: `${KINDS}.added_eyebrow`,
        value: `${KINDS}.added_title`,
        detail: `${KINDS}.added_detail`,
      },
      {
        id: "modules",
        icon: "i-ph-puzzle-piece",
        tone: "warning",
        eyebrow: `${KINDS}.modules_eyebrow`,
        value: `${KINDS}.modules_title`,
        detail: `${KINDS}.modules_detail`,
      },
    ],
  }).meta({
    name: `${TEXTS}.kinds`,
    description: `${TEXTS}.kinds_description`,
    icon: "i-ph-info",
  });

  static list = CustomComponent("DmsLangWorkspaceList")
    .meta({
      name: `${TEXTS}.list`,
      description: `${TEXTS}.list_description`,
      icon: "i-ph-stack",
    })
    .action(WORKSPACE_LIST_ACTIONS.create, {
      title: `${TEXTS}.create`,
      description: `${TEXTS}.create_description`,
      icon: "i-ph-plus",
    });
}
