import { CustomComponent } from "@antelopejs/interface-dms/base/custom";
import { Grid, GridRow } from "@antelopejs/interface-dms/base/grid";
import { StatGroup } from "@antelopejs/interface-dms/base/stat-group";
import { VStack } from "@antelopejs/interface-dms/base/stack";
import { PageController, RegisterPage } from "@antelopejs/interface-dms/page";
import {
  followTranslations,
  LANG_MODULE_ID,
  translateCategory,
} from "./module";
import { LANG_API, PERMISSION_TEXTS } from "../utils/constants";

const PAGE_ID = "language";
const TEXTS = `${PERMISSION_TEXTS}.language`;
const GAP = "1rem";
const MIN_COLUMN_WIDTH = "320px";
const QUEUE_SPAN = 2;
const STAT_COLUMNS = 2;
const STAT_COUNT = 4;

const queue = CustomComponent("DmsLangTranslationQueue").meta({
  name: `${TEXTS}.queue`,
  description: `${TEXTS}.queue_description`,
  icon: "i-ph-queue",
});

const progress = StatGroup({
  layout: "cards",
  columns: STAT_COLUMNS,
  label: "$dms_lang.progress.label",
  fetchUrl: `${LANG_API}/locale-stats?workspace={{query.workspace}}&locale={{query.locale}}`,
  skeletonCount: STAT_COUNT,
  empty: {
    title: "$dms_lang.progress.empty_title",
    description: "$dms_lang.progress.empty_description",
  },
}).meta({
  name: `${TEXTS}.progress`,
  description: `${TEXTS}.progress_description`,
  icon: "i-ph-chart-donut",
});

const namespaces = CustomComponent("DmsLangLanguageNamespaces").meta({
  name: `${TEXTS}.namespaces`,
  description: `${TEXTS}.namespaces_description`,
  icon: "i-ph-squares-four",
});

const side = VStack({ alignment: "stretch", spacing: GAP })
  .meta({ name: `${TEXTS}.side`, icon: "i-ph-sidebar-simple" })
  .child("progress", progress)
  .child("namespaces", namespaces);

@RegisterPage()
export class LangLanguageController extends PageController(PAGE_ID, {
  displayName: "$dms_lang.language.page_title",
  description: "$dms_lang.language.description",
  module: LANG_MODULE_ID,
  category: translateCategory,
  icon: "i-ph-text-aa",
  order: 2,
}) {
  static scope = CustomComponent("DmsLangWorkspaceScope").meta({
    name: `${PERMISSION_TEXTS}.scope`,
    description: `${PERMISSION_TEXTS}.scope_description`,
    icon: "i-ph-stack",
  });

  static content = Grid({ gap: GAP, minColumnWidth: MIN_COLUMN_WIDTH })
    .meta({ name: `${TEXTS}.content`, icon: "i-ph-layout" })
    .child(
      "main",
      GridRow()
        .meta({ name: `${TEXTS}.content`, icon: "i-ph-rows" })
        .child("queue", queue, { colSpan: QUEUE_SPAN })
        .child("side", side),
    );
}

followTranslations(translateCategory, PAGE_ID);
