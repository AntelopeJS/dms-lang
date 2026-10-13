import { CustomComponent } from "@antelopejs/interface-dms/base/custom";
import { DefaultLayout } from "@antelopejs/interface-dms/base/layouts";
import { PageController, RegisterPage } from "@antelopejs/interface-dms/page";
import { requireAction } from "./component-action";
import { addKeyButton } from "./header-actions";
import { countDefaultMissing } from "../utils/summary";
import { workspaceGuard } from "./workspace-guard";
import {
  followTranslations,
  LANG_MODULE_ID,
  translateCategory,
} from "./module";
import { PERMISSION_TEXTS } from "../utils/constants";

const PAGE_ID = "translations";
const TEXTS = `${PERMISSION_TEXTS}.translations`;

export const TRANSLATION_ACTIONS = {
  edit: "edit",
  keys: "keys",
} as const;

/** The matrix of the page, owning its edit and key actions. */
export const translationMatrix = CustomComponent("DmsLangTranslationMatrix")
  .meta({
    name: `${TEXTS}.matrix`,
    description: `${TEXTS}.matrix_description`,
    icon: "i-ph-table",
  })
  .action(TRANSLATION_ACTIONS.edit, {
    title: `${TEXTS}.edit`,
    description: `${TEXTS}.edit_description`,
    icon: "i-ph-pencil-simple",
  })
  .action(TRANSLATION_ACTIONS.keys, {
    title: `${TEXTS}.keys`,
    description: `${TEXTS}.keys_description`,
    icon: "i-ph-key",
  })
  .navBadge({ count: () => Promise.resolve(countDefaultMissing()) });

@RegisterPage()
export class LangTranslationsController extends PageController(
  PAGE_ID,
  {
    displayName: "$dms_lang.editor.page_title",
    description: "$dms_lang.editor.description",
    module: LANG_MODULE_ID,
    category: translateCategory,
    icon: "i-ph-translate",
    order: 1,
  },
  DefaultLayout({
    headerActions: [
      addKeyButton(requireAction(translationMatrix, TRANSLATION_ACTIONS.keys)),
    ],
  }),
) {
  static scope = CustomComponent("DmsLangWorkspaceScope").meta({
    name: `${PERMISSION_TEXTS}.scope`,
    description: `${PERMISSION_TEXTS}.scope_description`,
    icon: "i-ph-stack",
  });

  static scoped = workspaceGuard().child("matrix", translationMatrix);
}

followTranslations(translateCategory, PAGE_ID);
