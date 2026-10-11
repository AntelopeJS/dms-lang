/** The i18n namespace of the module's texts. */
export const LANG_TEXTS = "dms_lang";

/** The i18n keys of the pages' editor texts (blocks, actions, permissions). */
export const PERMISSION_TEXTS = `$${LANG_TEXTS}.permissions`;

/** The routes the pages and the frontend read the workspaces from. */
export const LANG_API = "/api/lang/translations";

/** The public, anonymous route serving the language files of the added workspaces. */
export const PUBLIC_PATH = "/i18n";

/** The pages of the module in the dashboard. */
export const PAGES_URL = "/modules/lang";

/** Where the project files of the dashboard keep their texts. */
export const PROJECT_FILES = "frontend-vue/i18n/locales/app-*.json";
