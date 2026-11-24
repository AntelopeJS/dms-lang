import { z } from "zod";
import { markReviewedService } from "../../services/keys";
import { resolveWorkspaceId } from "../../utils/catalog";
import { resolveRow } from "../../utils/resolve";
import {
  KEY_PORT,
  keyField,
  localesField,
  MAX_LIST_ITEMS,
  STRING,
  STRINGS,
  WORKSPACE_PORT,
  workspaceField,
} from "../fields";
import { assertAdded, nodeTexts, objectSchema, writeAction } from "../support";

const ID = "lang.mark-reviewed";
const texts = nodeTexts("actions", ID);

const input = z.object({
  workspace: workspaceField,
  key: keyField,
  locales: localesField,
});

export const markReviewedAction = writeAction({
  id: ID,
  icon: "i-ph-check-circle",
  inputSchema: objectSchema(
    {
      workspace: WORKSPACE_PORT,
      key: KEY_PORT,
      locales: {
        ...STRINGS,
        maxItems: MAX_LIST_ITEMS,
        description: texts.hint("locales"),
      },
    },
    ["workspace", "key"],
  ),
  outputSchema: objectSchema({
    workspace: STRING,
    key: STRING,
    reviewed: STRINGS,
    stillOutdated: STRINGS,
  }),
  input,
  run(request, writer, options) {
    assertAdded(ID, request.workspace);
    const before = options.dryRun
      ? (resolveRow(resolveWorkspaceId(request.workspace), request.key)
          ?.outdated ?? [])
      : [];
    const write = markReviewedService(
      {
        workspace: request.workspace,
        path: request.key,
        locales: request.locales,
      },
      writer,
      options,
    );
    const stillOutdated = options.dryRun
      ? before.filter((locale) => !write.reviewed.includes(locale))
      : (resolveRow(write.workspace, write.key)?.outdated ?? []);
    return {
      workspace: write.workspace,
      key: write.key,
      reviewed: write.reviewed,
      stillOutdated,
    };
  },
});
