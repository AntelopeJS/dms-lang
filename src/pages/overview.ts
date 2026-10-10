import { ButtonVariant } from "@antelopejs/interface-dms/base/types/button";
import { CustomComponent } from "@antelopejs/interface-dms/base/custom";
import { Grid, GridRow } from "@antelopejs/interface-dms/base/grid";
import { KeyValueList } from "@antelopejs/interface-dms/base/key-value-list";
import { DefaultLayout } from "@antelopejs/interface-dms/base/layouts";
import { StatGroup } from "@antelopejs/interface-dms/base/stat-group";
import { VStack } from "@antelopejs/interface-dms/base/stack";
import { PageController, RegisterPage } from "@antelopejs/interface-dms/page";
import { manageLanguagesAction } from "./actions";
import { languagesTable } from "./languages-table";
import { LANG_MODULE_ID, translateCategory } from "./module";
import { LANG_API, PERMISSION_TEXTS } from "./texts";

const TEXTS = `${PERMISSION_TEXTS}.overview`;
const SIDE_GAP = "1rem";
const MIN_COLUMN_WIDTH = "320px";
const LANGUAGES_SPAN = 2;
const KPI_COUNT = 4;
const ENDPOINT_ROWS = 2;
const API = LANG_API;

const languages = languagesTable(manageLanguagesAction).meta({
  name: `${TEXTS}.languages`,
  description: `${TEXTS}.languages_description`,
  icon: "i-ph-list-numbers",
});

const namespaces = CustomComponent("DmsLangNamespaceCoverage").meta({
  name: `${TEXTS}.namespaces`,
  description: `${TEXTS}.namespaces_description`,
  icon: "i-ph-squares-four",
});

const endpoint = KeyValueList({
  title: "$dms_lang.endpoint.title",
  fetchUrl: `${LANG_API}/endpoint?workspace={{query.workspace}}`,
  skeletonCount: ENDPOINT_ROWS,
}).meta({
  name: `${TEXTS}.endpoint`,
  description: `${TEXTS}.endpoint_description`,
  icon: "i-ph-plugs",
});

const side = VStack({ alignment: "stretch", spacing: SIDE_GAP })
  .meta({ name: `${TEXTS}.side`, icon: "i-ph-sidebar-simple" })
  .child("namespaces", namespaces)
  .child("endpoint", endpoint);

@RegisterPage()
export class LangOverviewController extends PageController(
  "overview",
  {
    displayName: "$dms_lang.overview.title",
    description: "$dms_lang.overview.description",
    module: LANG_MODULE_ID,
    category: translateCategory,
    icon: "i-ph-gauge",
    order: 0,
  },
  DefaultLayout({
    headerActions: [
      {
        id: "add-language",
        label: "$dms_lang.languages.add",
        icon: "i-ph-plus",
        variant: ButtonVariant.outline,
        color: "neutral",
        target: { type: "quickAction", id: "lang-add-language" },
      },
      {
        id: "translate-missing",
        label: "$dms_lang.quick_actions.translate_missing",
        icon: "i-ph-translate",
        target: {
          type: "page",
          url: "/modules/lang/translations?filter=missing",
        },
      },
    ],
  }),
) {
  static scope = CustomComponent("DmsLangWorkspaceScope").meta({
    name: `${PERMISSION_TEXTS}.scope`,
    description: `${PERMISSION_TEXTS}.scope_description`,
    icon: "i-ph-stack",
  });

  static kpis = StatGroup({
    layout: "cards",
    label: "$dms_lang.kpis.label",
    fetchUrl: `${API}/kpis?workspace={{query.workspace}}`,
    skeletonCount: KPI_COUNT,
  }).meta({
    name: `${TEXTS}.kpis`,
    description: `${TEXTS}.kpis_description`,
    icon: "i-ph-chart-bar",
  });

  static content = Grid({ gap: SIDE_GAP, minColumnWidth: MIN_COLUMN_WIDTH })
    .meta({ name: `${TEXTS}.content`, icon: "i-ph-layout" })
    .child(
      "main",
      GridRow()
        .meta({ name: `${TEXTS}.content`, icon: "i-ph-rows" })
        .child("languages", languages, { colSpan: LANGUAGES_SPAN })
        .child("side", side),
    );
}
