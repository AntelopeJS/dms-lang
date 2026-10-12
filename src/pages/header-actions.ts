import type { CustomButton } from "@antelopejs/interface-dms/base/types/custom-button";
import { PAGES_URL } from "../utils/constants";

/** The overview of the workspace of the URL. */
export const OPEN_OVERVIEW_BUTTON: CustomButton = {
  id: "open-overview",
  label: "$dms_lang.workspace.open_overview",
  icon: "i-ph-gauge",
  target: {
    type: "page",
    url: `${PAGES_URL}/overview?workspace={{query.workspace}}`,
  },
};
