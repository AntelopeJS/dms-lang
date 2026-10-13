import { CustomComponent } from "@antelopejs/interface-dms/base/custom";
import { StatGroup } from "@antelopejs/interface-dms/base/stat-group";
import { DefaultLayout } from "@antelopejs/interface-dms/base/layouts";
import { PageController, RegisterPage } from "@antelopejs/interface-dms/page";
import { requireAction } from "./component-action";
import { newWorkspaceButton } from "./header-actions";
import { followTranslations, LANG_MODULE_ID, manageCategory } from "./module";
import { PERMISSION_TEXTS } from "../utils/constants";

const PAGE_ID = "workspaces";
const TEXTS = `${PERMISSION_TEXTS}.workspaces`;
const KINDS = "$dms_lang.workspaces.kinds";

export const WORKSPACE_LIST_ACTIONS = {
  create: "create",
} as const;

/** The workspace cards, owning the "create workspaces" action. */
export const workspaceList = CustomComponent("DmsLangWorkspaceList")
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

@RegisterPage()
export class LangWorkspacesController extends PageController(
  PAGE_ID,
  {
    displayName: "$dms_lang.workspaces.title",
    description: "$dms_lang.workspaces.description",
    module: LANG_MODULE_ID,
    category: manageCategory,
    icon: "i-ph-stack",
    order: 0,
  },
  DefaultLayout({
    headerActions: [
      newWorkspaceButton(
        requireAction(workspaceList, WORKSPACE_LIST_ACTIONS.create),
      ),
    ],
  }),
) {
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

  static list = workspaceList;
}

followTranslations(manageCategory, PAGE_ID);
