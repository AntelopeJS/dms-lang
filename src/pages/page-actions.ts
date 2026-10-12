/** The query a page reads to open one of its dialogs on arrival. */
export const PAGE_ACTION_QUERY = "action";

/** The dialogs a page opens on arrival, by their `?action=` value. */
export const PAGE_ACTIONS = {
  addLanguage: "add-language",
  addKey: "add-key",
  newWorkspace: "new-workspace",
} as const;
