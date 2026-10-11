import {
  Category,
  type CategoryInfo,
  RegisterModule,
} from "@antelopejs/interface-dms/page";
import { RegisterPageTopic } from "@antelopejs/interface-dms/realtime";

export const LANG_MODULE_ID = "lang";

/** Published by every write route; the pages of the module reload on it. */
export const LANG_REALTIME_TOPIC = "dms-lang.translations";

export const langModule = RegisterModule({
  id: LANG_MODULE_ID,
  title: "$dms_lang.title",
  description: "$dms_lang.description",
  icon: "i-ph-translate",
  landingPage: "overview",
  catalogCategory: "$dms_lang.catalog_category",
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

/** Delivers the module's realtime messages to the sessions on a page. */
export function followTranslations(category: CategoryInfo, pageId: string) {
  RegisterPageTopic(`${category.fullId}.${pageId}`, LANG_REALTIME_TOPIC);
}
