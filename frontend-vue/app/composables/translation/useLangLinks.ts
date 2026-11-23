import { useI18nWorkspaces } from './useI18nWorkspaces.ts'
const MODULE_BASE = '/modules/lang'

export const LANG_PAGES = {
  overview: `${MODULE_BASE}/overview`,
  translations: `${MODULE_BASE}/translations`,
  language: `${MODULE_BASE}/language`,
  workspaces: `${MODULE_BASE}/workspaces`,
  workspace: `${MODULE_BASE}/workspace`,
} as const

export type LangPage = keyof typeof LANG_PAGES

export type PageQuery = Record<string, string | undefined>

/** The query a page reads to open one of its dialogs on arrival. */
export const PAGE_ACTION_QUERY = 'action'

export const PAGE_ACTIONS = {
  addLanguage: 'add-language',
  addKey: 'add-key',
  newWorkspace: 'new-workspace',
} as const

export const LOCALE_PLACEHOLDER = '{locale}'

export function linkWithQuery(path: string, query: PageQuery): string {
  const params = new URLSearchParams()
  for (const [name, value] of Object.entries(query)) {
    if (value) params.set(name, value)
  }
  const search = params.toString()
  return search ? `${path}?${search}` : path
}

function isLangPage(name: string): name is LangPage {
  return Object.hasOwn(LANG_PAGES, name)
}

/** The module page a path shows, if it is one. */
export function langPageOf(path: string): LangPage | undefined {
  return Object.keys(LANG_PAGES)
    .filter(isLangPage)
    .find((page) => LANG_PAGES[page] === path)
}

/**
 * Links to the pages of the module, each carrying the selected workspace, and
 * the public URL the server gives a workspace's language files.
 */
export const useLangLinks = () => {
  const { selectedWorkspace, workspaces, publicBaseUrl } = useI18nWorkspaces()

  function publicLocaleUrl(workspace: string, locale = LOCALE_PLACEHOLDER) {
    const known = workspaces.value.find((entry) => entry.id === workspace)
    if (known && known.kind !== 'added') return ''
    const template =
      known?.publicUrl ??
      `${publicBaseUrl.value}/${workspace}/${LOCALE_PLACEHOLDER}.json`
    return template.replace(LOCALE_PLACEHOLDER, locale)
  }

  function pageLink(page: LangPage, query: PageQuery = {}): string {
    return linkWithQuery(LANG_PAGES[page], {
      workspace: selectedWorkspace.value,
      ...query,
    })
  }

  return {
    pageLink,
    publicLocaleUrl,
    overview: (query: PageQuery = {}) => pageLink('overview', query),
    translations: (query: PageQuery = {}) => pageLink('translations', query),
    language: (locale: string, query: PageQuery = {}) =>
      pageLink('language', { locale, ...query }),
    workspaces: (query: PageQuery = {}) => pageLink('workspaces', query),
    workspaceSettings: (workspace?: string) =>
      pageLink('workspace', workspace ? { workspace } : {}),
  }
}
