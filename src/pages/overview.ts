import { PageController, RegisterPage } from "@antelopejs/interface-dms/page";
import { CustomComponent } from "@antelopejs/interface-dms/base/custom";
import { DefaultLayout } from "@antelopejs/interface-dms/base/layouts";

@RegisterPage()
export class LangOverviewController extends PageController(
  "overview",
  {
    displayName: "$dms_lang.overview.title",
    module: "lang",
    icon: "i-ph-gauge",
    description: "$dms_lang.overview.description",
    order: 0,
  },
  DefaultLayout({ fullWidth: true }),
) {
  static overviewComponent = CustomComponent("DmsLangOverview").meta({
    name: "$dms_lang.overview.title",
    icon: "i-ph-gauge",
  });
}
