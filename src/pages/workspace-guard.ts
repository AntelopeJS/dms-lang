import { Guard } from "@antelopejs/interface-dms/base/guard";
import { LANG_REALTIME_TOPIC } from "./module";
import { LANG_API, PAGES_URL, PERMISSION_TEXTS } from "../utils/constants";
import { DEFAULT_WORKSPACE } from "../utils/workspaces";

const TEXTS = "$dms_lang.scope";

/**
 * The blocks of a page scoped by `?workspace=`, replaced by one "workspace
 * not found" state when the workspace in the URL does not exist (the route
 * answers 404), and again as soon as another tab deletes it.
 */
export function workspaceGuard() {
  return Guard({
    fetchUrl: `${LANG_API}/workspace?workspace={{query.workspace}}`,
    when: "notFound",
    realtimeTopic: LANG_REALTIME_TOPIC,
    fallback: {
      title: `${TEXTS}.unknown_title`,
      description: `${TEXTS}.unknown_description`,
      icon: "i-ph-stack",
      variant: "no-result",
      size: "lg",
      hatched: true,
      actions: [
        {
          label: `${TEXTS}.unknown_action`,
          icon: "i-ph-arrow-right",
          to: `${PAGES_URL}/workspaces?workspace=${DEFAULT_WORKSPACE}`,
        },
      ],
    },
  }).meta({
    name: `${PERMISSION_TEXTS}.guard`,
    description: `${PERMISSION_TEXTS}.guard_description`,
    icon: "i-ph-shield-check",
  });
}
