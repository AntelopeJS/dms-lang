import { ButtonVariant } from "@antelopejs/interface-dms/base/types/button";
import type { CustomRowAction } from "@antelopejs/interface-dms/base/types/row-action";
import { DefaultDataTypes } from "@antelopejs/interface-dms/base/data-types/default-types";
import {
  DefaultDisplays,
  TableView,
} from "@antelopejs/interface-dms/base/table-view";
import type { Action } from "@antelopejs/interface-dms/component";
import { LANG_API, PAGES_URL } from "../utils/constants";
import { LANG_REALTIME_TOPIC } from "./module";

const TEXTS = "$dms_lang.languages";
const NAME_SIZE = 280;
const COVERAGE_SIZE = 220;
const BASE = { field: "isBase", equals: true };
const EDITABLE_BASE = { and: [BASE, { field: "canEdit", equals: true }] };
const TARGET = { field: "isBase", equals: false };
const MANAGEABLE = { and: [TARGET, { field: "canManage", equals: true }] };
const LANGUAGE_URL = `${LANG_API}/languages/{{row.workspace}}/{{row.code}}`;

const columns = {
  name: {
    name: `${TEXTS}.column_language`,
    type: new DefaultDataTypes.StringType(),
    display: new DefaultDisplays.IdentityDisplay({
      icon: "i-ph-translate",
      subtitleField: "detail",
      badges: [
        {
          ...BASE,
          label: "$dms_lang.common.base",
          tone: "neutral",
        },
      ],
    }),
    size: NAME_SIZE,
    sortable: true,
    order: 1,
  },
  coverage: {
    name: `${TEXTS}.coverage`,
    type: new DefaultDataTypes.NumberType(),
    display: new DefaultDisplays.ProgressDisplay({
      doneField: "translated",
      totalField: "total",
    }),
    size: COVERAGE_SIZE,
    sortable: true,
    order: 2,
  },
};

/** Translate a target language, edit the base: links to the other pages. */
const PAGE_LINKS: CustomRowAction[] = [
  {
    label: `${TEXTS}.translate`,
    icon: "i-ph-translate",
    target: {
      type: "page",
      url: `${PAGES_URL}/language?workspace={{row.workspace}}&locale={{row.code}}`,
    },
    rule: TARGET,
    isVisible: true,
    showLabel: true,
    variant: ButtonVariant.outline,
    isDefault: true,
  },
  {
    label: `${TEXTS}.edit_base`,
    icon: "i-ph-table",
    target: {
      type: "page",
      url: `${PAGES_URL}/translations?workspace={{row.workspace}}`,
    },
    rule: EDITABLE_BASE,
    isVisible: true,
    showLabel: true,
    variant: ButtonVariant.outline,
    isDefault: true,
  },
];

/** Make a target the base or remove it: the writes, behind their permission. */
function managedActions(manageLanguages: Action): CustomRowAction[] {
  return [
    {
      label: `${TEXTS}.make_base_named`,
      icon: "i-ph-star",
      target: {
        type: "api",
        url: `${LANGUAGE_URL}/base`,
        method: "POST",
        successMessage: "$dms_lang.language_base.done_generic",
      },
      confirm: { from: `${LANGUAGE_URL}/base-confirm` },
      rule: MANAGEABLE,
      permission: manageLanguages,
    },
    {
      label: `${TEXTS}.remove_named`,
      icon: "i-ph-trash",
      color: "error",
      target: {
        type: "api",
        url: LANGUAGE_URL,
        method: "DELETE",
        successMessage: "$dms_lang.language_remove.done",
      },
      confirm: { from: `${LANGUAGE_URL}/removal-confirm` },
      rule: MANAGEABLE,
      permission: manageLanguages,
    },
  ];
}

/**
 * The languages of the workspace in the URL (`?workspace=`), least complete
 * first with the base pinned on top under any sort: translate, make base,
 * remove.
 */
export function languagesTable(manageLanguages: Action) {
  return TableView.fromSource({
    caption: `${TEXTS}.title`,
    fetchUrl: `${LANG_API}/languages?workspace={{query.workspace}}`,
    columns,
    defaultSort: { field: "coverage" },
    pinnedRows: BASE,
    realtimeTopic: LANG_REALTIME_TOPIC,
    // The tab that deletes the workspace leaves its page once the DELETE
    // answers: reading the languages again on its own echo would ask for the
    // deleted workspace (404). Other tabs still refresh.
    ignoreOwnRealtimeEvents: true,
    layout: "full",
    labelKey: "name",
    rowActions: { custom: [...PAGE_LINKS, ...managedActions(manageLanguages)] },
  });
}
