import { Banner } from "@antelopejs/interface-dms/base/banner";
import { CustomComponent } from "@antelopejs/interface-dms/base/custom";
import { Grid, GridRow } from "@antelopejs/interface-dms/base/grid";
import { VStack } from "@antelopejs/interface-dms/base/stack";
import { PageController, RegisterPage } from "@antelopejs/interface-dms/page";
import { LANG_MODULE_ID, manageCategory } from "./module";
import { PERMISSION_TEXTS } from "./texts";

const TEXTS = `${PERMISSION_TEXTS}.workspace`;
const GAP = "1rem";
const MIN_COLUMN_WIDTH = "300px";
const MAIN_SPAN = 2;

export const WORKSPACE_ACTIONS = {
  languages: "languages",
  rename: "rename",
  delete: "delete",
} as const;

export const workspaceGeneral = CustomComponent("DmsLangWorkspaceGeneral")
  .meta({
    name: `${TEXTS}.general`,
    description: `${TEXTS}.general_description`,
    icon: "i-ph-sliders",
  })
  .action(WORKSPACE_ACTIONS.languages, {
    title: `${TEXTS}.languages`,
    description: `${TEXTS}.languages_description`,
    icon: "i-ph-translate",
  });

const integration = CustomComponent("DmsLangWorkspaceIntegration").meta({
  name: `${TEXTS}.integration`,
  description: `${TEXTS}.integration_description`,
  icon: "i-ph-plugs",
});

export const workspaceDangerZone = CustomComponent("DmsLangWorkspaceDangerZone")
  .meta({
    name: `${TEXTS}.danger`,
    description: `${TEXTS}.danger_description`,
    icon: "i-ph-warning",
  })
  .action(WORKSPACE_ACTIONS.rename, {
    title: `${TEXTS}.rename`,
    description: `${TEXTS}.rename_description`,
    icon: "i-ph-pencil-simple",
  })
  .action(WORKSPACE_ACTIONS.delete, {
    title: `${TEXTS}.delete`,
    description: `${TEXTS}.delete_description`,
    icon: "i-ph-trash",
  });

const about = CustomComponent("DmsLangWorkspaceAbout").meta({
  name: `${TEXTS}.about`,
  description: `${TEXTS}.about_description`,
  icon: "i-ph-info",
});

const keysNote = Banner({
  tone: "info",
  size: "md",
  icon: "i-ph-info",
  title: "$dms_lang.workspace.keys_note_title",
  description: "$dms_lang.workspace.keys_note_description",
}).meta({
  name: `${TEXTS}.keys_note`,
  description: `${TEXTS}.keys_note_description`,
  icon: "i-ph-info",
});

const main = VStack({ alignment: "stretch", spacing: GAP })
  .meta({ name: `${TEXTS}.main`, icon: "i-ph-rows" })
  .child("general", workspaceGeneral)
  .child("integration", integration)
  .child("danger", workspaceDangerZone);

const side = VStack({ alignment: "stretch", spacing: GAP })
  .meta({ name: `${TEXTS}.side`, icon: "i-ph-sidebar-simple" })
  .child("about", about)
  .child("keysNote", keysNote);

@RegisterPage()
export class LangWorkspaceController extends PageController("workspace", {
  displayName: "$dms_lang.workspace.title",
  description: "$dms_lang.workspace.description",
  module: LANG_MODULE_ID,
  category: manageCategory,
  icon: "i-ph-gear-six",
  order: 1,
  hidden: true,
  validation: { requiredQueryParams: ["workspace"] },
}) {
  static content = Grid({ gap: GAP, minColumnWidth: MIN_COLUMN_WIDTH })
    .meta({ name: `${TEXTS}.content`, icon: "i-ph-layout" })
    .child(
      "main",
      GridRow()
        .meta({ name: `${TEXTS}.content`, icon: "i-ph-rows" })
        .child("main", main, { colSpan: MAIN_SPAN })
        .child("side", side),
    );
}
