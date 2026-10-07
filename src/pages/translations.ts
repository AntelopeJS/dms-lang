import { CustomComponent } from "@antelopejs/interface-dms/base/custom";
import { PageController, RegisterPage } from "@antelopejs/interface-dms/page";
import { countDefaultMissing } from "../utils/summary";
import { LANG_MODULE_ID, translateCategory } from "./module";
import { PERMISSION_TEXTS } from "./texts";

const TEXTS = `${PERMISSION_TEXTS}.translations`;

export const TRANSLATION_ACTIONS = {
  edit: "edit",
  keys: "keys",
} as const;

@RegisterPage()
export class LangTranslationsController extends PageController("translations", {
  displayName: "$dms_lang.editor.title",
  description: "$dms_lang.editor.description",
  module: LANG_MODULE_ID,
  category: translateCategory,
  icon: "i-ph-translate",
  order: 1,
}) {
  static scope = CustomComponent("DmsLangWorkspaceScope").meta({
    name: `${PERMISSION_TEXTS}.scope`,
    description: `${PERMISSION_TEXTS}.scope_description`,
    icon: "i-ph-stack",
  });

  static matrix = CustomComponent("DmsLangTranslationMatrix")
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
}
