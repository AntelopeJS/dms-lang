import { z } from "zod";
import { removeOverrideService } from "../../services/keys";
import { currentText } from "../../utils/keys";
import { DEFAULT_WORKSPACE } from "../../utils/workspaces";
import {
  KEY_PORT,
  keyField,
  localesField,
  MAX_LIST_ITEMS,
  OBJECT,
  STRING,
  STRINGS,
} from "../fields";
import { nodeTexts, objectSchema, writeAction } from "../support";

const ID = "lang.remove-override";
const texts = nodeTexts("actions", ID);

const input = z.object({ key: keyField, locales: localesField });

export const removeOverrideAction = writeAction({
  id: ID,
  icon: "i-ph-arrow-counter-clockwise",
  inputSchema: objectSchema(
    {
      key: KEY_PORT,
      locales: {
        ...STRINGS,
        maxItems: MAX_LIST_ITEMS,
        description: texts.hint("locales"),
      },
    },
    ["key"],
  ),
  outputSchema: objectSchema({
    key: STRING,
    removedLocales: STRINGS,
    moduleTexts: OBJECT,
  }),
  input,
  run(request, writer, options) {
    const write = removeOverrideService(
      {
        workspace: DEFAULT_WORKSPACE,
        path: request.key,
        locales: request.locales,
      },
      writer,
      options,
    );
    const moduleTexts = Object.fromEntries(
      write.removed.locales.map((locale) => [
        locale,
        currentText(write.store.reference[locale], write.key) ?? "",
      ]),
    );
    return {
      key: write.key,
      removedLocales: write.removed.locales,
      moduleTexts,
    };
  },
});
