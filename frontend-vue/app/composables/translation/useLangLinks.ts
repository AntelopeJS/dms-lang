import { useDmsRuntimeConfig } from '#dms/frontend-module'

const MODULE_BASE = '/modules/lang'

export const LANG_PAGES = {
  overview: `${MODULE_BASE}/overview`,
  translations: `${MODULE_BASE}/translations`,
  language: `${MODULE_BASE}/language`,
  workspaces: `${MODULE_BASE}/workspaces`,
  workspace: `${MODULE_BASE}/workspace`,
} as const

export type LangPage = keyof typeof LANG_PAGES

/** The query a page reads to open one of its dialogs on arrival. */
export const PAGE_ACTION_QUERY = 'action'

export const PAGE_ACTIONS = {
  addLanguage: 'add-language',
  addKey: 'add-key',
  newWorkspace: 'new-workspace',
} as const

function withQuery(path: string, query: Record<string, string | undefined>) {
  const params = new URLSearchParams()
  for (const [name, value] of Object.entries(query)) {
    if (value) params.set(name, value)
  }
  const search = params.toString()
  return search ? `${path}?${search}` : path
}

const LOCALE_PLACEHOLDER = '{locale}'

/** Links to the pages of the module, carrying the workspace they act on. */
export const useLangLinks = () => {
  const { selectedWorkspace } = useI18nWorkspaces()
  const baseUrl = useDmsRuntimeConfig().public.dms.baseURL

  function publicLocaleUrl(workspace: string, locale = LOCALE_PLACEHOLDER) {
    return `${baseUrl}/i18n/${workspace}/${locale}.json`
  }

  function pageLink(
    page: LangPage,
    query: Record<string, string | undefined> = {},
  ): string {
    return withQuery(LANG_PAGES[page], {
      workspace: selectedWorkspace.value,
      ...query,
    })
  }

  return {
    pageLink,
    publicLocaleUrl,
    overview: () => pageLink('overview'),
    translations: (query: Record<string, string | undefined> = {}) =>
      pageLink('translations', query),
    language: (
      locale: string,
      query: Record<string, string | undefined> = {},
    ) => pageLink('language', { locale, ...query }),
    workspaces: (query: Record<string, string | undefined> = {}) =>
      withQuery(LANG_PAGES.workspaces, query),
    workspaceSettings: (workspace: string) =>
      withQuery(LANG_PAGES.workspace, { workspace }),
  }
}
