import { addLanguageAction } from "../../automation/actions/add-language";
import { createKeyAction } from "../../automation/actions/create-key";
import { createWorkspaceAction } from "../../automation/actions/create-workspace";
import { step } from "./automation";

/** Creates an added workspace with its languages (the first is the base) and keys, through the actions. */
export async function seedWorkspace(
  id: string,
  locales: string[],
  keys: Record<string, Record<string, string>> = {},
): Promise<void> {
  const base = locales[0] ?? "en";
  await step(createWorkspaceAction, { id, baseLocale: base });
  for (const code of locales.slice(1))
    await step(addLanguageAction, { workspace: id, code });
  for (const [key, texts] of Object.entries(keys)) {
    const { [base]: baseText = "", ...others } = texts;
    await step(createKeyAction, {
      workspace: id,
      key,
      baseText,
      texts: others,
    });
  }
}
