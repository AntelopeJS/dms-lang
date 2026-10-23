import { Banner } from "@antelopejs/interface-dms/base/banner";
import { CustomComponent } from "@antelopejs/interface-dms/base/custom";
import { Grid, GridRow } from "@antelopejs/interface-dms/base/grid";
import { Card } from "@antelopejs/interface-dms/base/card";
import { CodeBlock } from "@antelopejs/interface-dms/base/code-block";
import { KeyValueList } from "@antelopejs/interface-dms/base/key-value-list";
import { Tab } from "@antelopejs/interface-dms/base/tab";
import { VStack } from "@antelopejs/interface-dms/base/stack";
import { PageController, RegisterPage } from "@antelopejs/interface-dms/page";
import { DefaultLayout } from "@antelopejs/interface-dms/base/layouts";
import { requireAction } from "./component-action";
import { OPEN_OVERVIEW_BUTTON } from "./header-actions";
import { languagesTable } from "./languages-table";
import { workspaceGuard } from "./workspace-guard";
import {
  followTranslations,
  LANG_MODULE_ID,
  LANG_REALTIME_TOPIC,
  manageCategory,
} from "./module";
import { LangWorkspacesController } from "./workspaces";
import { workspaceSummary } from "../utils/catalog";
import { LANG_API, PERMISSION_TEXTS } from "../utils/constants";
import { SNIPPET_KINDS } from "../utils/snippets";

const PAGE_ID = "workspace";
const TEXTS = `${PERMISSION_TEXTS}.workspace`;
const GAP = "1rem";
const MIN_COLUMN_WIDTH = "300px";
const MAIN_SPAN = 2;
const ABOUT_ROWS = 5;
const ENDPOINT_ROWS = 2;

export const WORKSPACE_ACTIONS = {
  edit: "edit",
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
  .action(WORKSPACE_ACTIONS.edit, {
    title: `${TEXTS}.edit`,
    description: `${TEXTS}.edit_description`,
    icon: "i-ph-note-pencil",
  })
  .action(WORKSPACE_ACTIONS.languages, {
    title: `${TEXTS}.languages`,
    description: `${TEXTS}.languages_description`,
    icon: "i-ph-translate",
  });

function snippetTabs() {
  const tabs = Tab({
    items: SNIPPET_KINDS.map((kind) => ({
      label: `$dms_lang.endpoint.snippet_${kind}`,
      slot: kind,
    })),
    variant: "link",
    size: "sm",
  }).meta({ name: `${TEXTS}.snippets`, icon: "i-ph-code" });
  for (const kind of SNIPPET_KINDS) {
    tabs.child(
      kind,
      CodeBlock({
        fetchUrl: `${LANG_API}/snippet?workspace={{query.workspace}}&kind=${kind}`,
        language: "javascript",
      }).meta({ name: `${TEXTS}.snippet`, icon: "i-ph-code" }),
      { slot: kind },
    );
  }
  return tabs;
}

const integration = Card({ title: "$dms_lang.endpoint.title" })
  .meta({
    name: `${TEXTS}.integration`,
    description: `${TEXTS}.integration_description`,
    icon: "i-ph-plugs",
  })
  .child(
    "endpoint",
    KeyValueList({
      card: false,
      fetchUrl: `${LANG_API}/endpoint?workspace={{query.workspace}}`,
      realtimeTopic: LANG_REALTIME_TOPIC,
      skeletonCount: ENDPOINT_ROWS,
    }).meta({ name: `${TEXTS}.endpoint`, icon: "i-ph-link" }),
  )
  .child("snippets", snippetTabs());

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

const about = KeyValueList({
  title: "$dms_lang.about.title",
  dense: true,
  fetchUrl: `${LANG_API}/about?workspace={{query.workspace}}`,
  realtimeTopic: LANG_REALTIME_TOPIC,
  skeletonCount: ABOUT_ROWS,
}).meta({
  name: `${TEXTS}.about`,
  description: `${TEXTS}.about_description`,
  icon: "i-ph-info",
});

const notice = Banner({
  fetchUrl: `${LANG_API}/notice?workspace={{query.workspace}}&page=${PAGE_ID}`,
  realtimeTopic: LANG_REALTIME_TOPIC,
}).meta({
  name: `${TEXTS}.keys_note`,
  description: `${TEXTS}.keys_note_description`,
  icon: "i-ph-info",
});

const languages = languagesTable(
  requireAction(workspaceGeneral, WORKSPACE_ACTIONS.languages),
).meta({
  name: `${TEXTS}.languages_table`,
  description: `${TEXTS}.languages_table_description`,
  icon: "i-ph-list-numbers",
});

const main = VStack({ alignment: "stretch", spacing: GAP })
  .meta({ name: `${TEXTS}.main`, icon: "i-ph-rows" })
  .child("general", workspaceGeneral)
  .child("languages", languages)
  .child("integration", integration)
  .child("danger", workspaceDangerZone);

const side = VStack({ alignment: "stretch", spacing: GAP })
  .meta({ name: `${TEXTS}.side`, icon: "i-ph-sidebar-simple" })
  .child("about", about)
  .child("keysNote", notice);

const content = Grid({ gap: GAP, minColumnWidth: MIN_COLUMN_WIDTH })
  .meta({ name: `${TEXTS}.content`, icon: "i-ph-layout" })
  .child(
    "main",
    GridRow()
      .meta({ name: `${TEXTS}.content`, icon: "i-ph-rows" })
      .child("main", main, { colSpan: MAIN_SPAN })
      .child("side", side),
  );

@RegisterPage()
export class LangWorkspaceController extends PageController(
  PAGE_ID,
  {
    displayName: "$dms_lang.workspace.title",
    description: "$dms_lang.workspace.description",
    module: LANG_MODULE_ID,
    category: manageCategory,
    icon: "i-ph-gear-six",
    order: 1,
    // Its list: the page opens it once the workspace it shows is deleted.
    parent: LangWorkspacesController,
  },
  DefaultLayout({
    // The workspace the page shows: a tab on it leaves for the list once
    // another deletes it.
    record: ({ query }) => {
      const summary = workspaceSummary(query?.workspace);
      return summary && { ...summary };
    },
    headerActions: [OPEN_OVERVIEW_BUTTON],
  }),
) {
  static scope = CustomComponent("DmsLangWorkspaceScope").meta({
    name: `${PERMISSION_TEXTS}.scope`,
    description: `${PERMISSION_TEXTS}.scope_description`,
    icon: "i-ph-stack",
  });

  static scoped = workspaceGuard().child("content", content);
}

followTranslations(manageCategory, PAGE_ID);
