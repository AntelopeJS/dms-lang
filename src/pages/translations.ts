import { PageController, RegisterPage } from "@antelopejs/interface-dms/page";
import { CustomComponent } from "@antelopejs/interface-dms/base/custom";
import { DefaultLayout } from "@antelopejs/interface-dms/base/layouts";

@RegisterPage()
export class LangTranslationsController extends PageController(
  "translations",
  {
    displayName: "$dms_lang.editor.title",
    module: "lang",
    icon: "i-ph-translate",
    description: "$dms_lang.editor.description",
    order: 1,
  },
  DefaultLayout({ fullWidth: true }),
) {
  static translationsComponent = CustomComponent("DmsLangTranslations").meta({
    name: "$dms_lang.editor.title",
    icon: "i-ph-translate",
  });
}
