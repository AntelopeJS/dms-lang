import { ButtonVariant } from "@antelopejs/interface-dms/base/types/button";
import { DefaultDataTypes } from "@antelopejs/interface-dms/base/data-types/default-types";
import {
  DefaultDisplays,
  TableView,
} from "@antelopejs/interface-dms/base/table-view";
import type { Action } from "@antelopejs/interface-dms/component";
import { LANG_API } from "./texts";

const TEXTS = "$dms_lang.languages";
const NAME_SIZE = 280;
const COVERAGE_SIZE = 220;
const MANAGEABLE = {
  and: [
    { field: "isBase", equals: false },
    { field: "canManage", equals: true },
  ],
};
const LANGUAGE_URL = `${LANG_API}/languages/{workspace}/{code}`;

const columns = {
  name: {
    name: `${TEXTS}.column_language`,
    type: new DefaultDataTypes.StringType(),
    display: new DefaultDisplays.IdentityDisplay({
      icon: "i-ph-translate",
      subtitleField: "detail",
      badges: [
        {
          field: "isBase",
          equals: true,
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
    order: 2,
  },
  rank: {
    name: `${TEXTS}.column_rank`,
    type: new DefaultDataTypes.NumberType(),
    isVisible: false,
    sortable: true,
    order: 3,
  },
};

/**
 * The languages of the workspace in the URL (`?workspace=`), least complete
 * first with the base pinned on top: translate, make base, remove.
 */
export function languagesTable(manageLanguages: Action) {
  return TableView.fromSource({
    caption: `${TEXTS}.title`,
    fetchUrl: `${LANG_API}/languages?workspace={{query.workspace}}`,
    columns,
    defaultSort: { field: "rank" },
    layout: "compact",
    labelKey: "name",
    rowActions: {
      custom: [
        {
          label: `${TEXTS}.translate`,
          icon: "i-ph-translate",
          target: {
            type: "page",
            url: "/modules/lang/language?workspace={workspace}&locale={code}",
          },
          isVisible: true,
          showLabel: true,
          variant: ButtonVariant.outline,
          isDefault: true,
        },
        {
          label: `${TEXTS}.make_base`,
          icon: "i-ph-star",
          target: {
            type: "api",
            url: `${LANGUAGE_URL}/base`,
            method: "POST",
            successMessage: "$dms_lang.language_base.done_generic",
          },
          rule: MANAGEABLE,
          permission: manageLanguages,
        },
        {
          label: `${TEXTS}.remove`,
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
      ],
    },
  });
}
