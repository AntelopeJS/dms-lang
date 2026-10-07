import { Category, RegisterModule } from "@antelopejs/interface-dms/page";

export const LANG_MODULE_ID = "lang";

export const langModule = RegisterModule({
  id: LANG_MODULE_ID,
  title: "$dms_lang.title",
  description: "$dms_lang.description",
  icon: "i-ph-translate",
  landingPage: "overview",
});

export const translateCategory = Category("translate", {
  displayName: "$dms_lang.nav.translate",
  category: langModule,
  module: LANG_MODULE_ID,
  icon: "i-ph-translate",
  urlSlug: "/",
  type: "label",
  order: 0,
});

export const manageCategory = Category("manage", {
  displayName: "$dms_lang.nav.manage",
  category: langModule,
  module: LANG_MODULE_ID,
  icon: "i-ph-stack",
  urlSlug: "/",
  type: "label",
  order: 1,
});
