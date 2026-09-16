import { RegisterModule } from "@antelopejs/interface-dms/page";

export const langModule = RegisterModule({
  id: "lang",
  title: "$dms_lang.title",
  description: "$dms_lang.description",
  icon: "i-ph-translate",
  landingPage: "overview",
});
