import { useDmsRoute, useDmsRouter } from '#dms/frontend-module'

export interface SelectWorkspaceOptions {
  /** The page to land on; the current one by default. */
  page?: LangPage
  /** Query the target page keeps; everything else is left behind. */
  query?: PageQuery
  /** Replace the history entry (an id that no longer exists). */
  replace?: boolean
}

const FALLBACK_PAGE: LangPage = 'overview'
const LOCALE_QUERY = 'locale'

/**
 * Keeps the selected workspace in the page URL (`?workspace=`): a shared link
 * or a refresh lands on the same workspace, and the page reacts when the
 * query changes. `selectWorkspace` is the one way to change it. Also reads the
 * dialog a page was asked to open on arrival.
 */
export const useWorkspaceRoute = () => {
  const route = useDmsRoute()
  const router = useDmsRouter()
  const { selectedWorkspace, workspaces, rememberWorkspace } =
    useI18nWorkspaces()

  const queryWorkspace = computed(() => route.query.workspace || '')
  const pageAction = computed(() => route.query[PAGE_ACTION_QUERY] || '')
  const currentPage = computed(() => langPageOf(route.path) ?? FALLBACK_PAGE)

  watch(
    queryWorkspace,
    (raw) => {
      if (!raw) return
      const workspace = normalizeWorkspaceId(raw)
      selectedWorkspace.value = workspace
      if (workspace !== raw && !import.meta.env.SSR) {
        void router.replace(
          linkWithQuery(route.path, { ...route.query, workspace }),
        )
      }
    },
    { immediate: true },
  )

  watch([selectedWorkspace, workspaces], ([workspace, list]) => {
    if (list.some((entry) => entry.id === workspace)) {
      rememberWorkspace(workspace)
    }
  })

  /** The language the queue opens on in a workspace: the current one when it is there, else its first translation. */
  function queueLocaleOf(workspace: string, locale: string): string {
    const target = workspaces.value.find((entry) => entry.id === workspace)
    const codes = (target?.locales ?? [])
      .map((entry) => entry.code)
      .filter((code) => code !== target?.defaultLocale)
    return codes.includes(locale) ? locale : (codes[0] ?? '')
  }

  // The language page stays the language page: it keeps its language when the
  // target workspace has it, else opens on one the target has (or asks for one).
  function targetOf(workspace: string, options: SelectWorkspaceOptions) {
    const page = options.page ?? currentPage.value
    if (page !== 'language' || options.page || options.query?.[LOCALE_QUERY]) {
      return { page, query: options.query ?? {} }
    }
    const locale = queueLocaleOf(workspace, route.query[LOCALE_QUERY] ?? '')
    return { page, query: locale ? { [LOCALE_QUERY]: locale } : {} }
  }

  /** The URL `selectWorkspace` goes to, for a link (`to:`). */
  function switchLink(
    workspace: string,
    options: SelectWorkspaceOptions = {},
  ): string {
    const id = normalizeWorkspaceId(workspace)
    const target = targetOf(id, options)
    return linkWithQuery(LANG_PAGES[target.page], {
      workspace: id,
      ...target.query,
    })
  }

  /**
   * Selects a workspace: the state at once, then the URL. Filters, the open
   * key and a pending dialog belong to the workspace left, so they are dropped.
   */
  async function selectWorkspace(
    workspace: string,
    options: SelectWorkspaceOptions = {},
  ): Promise<void> {
    const link = switchLink(workspace, options)
    selectedWorkspace.value = normalizeWorkspaceId(workspace)
    if (import.meta.env.SSR) return
    await (options.replace ? router.replace(link) : router.push(link))
  }

  async function clearPageAction(): Promise<void> {
    if (!pageAction.value) return
    const params = new URLSearchParams(route.query)
    params.delete(PAGE_ACTION_QUERY)
    if (!params.get('workspace') && selectedWorkspace.value) {
      params.set('workspace', selectedWorkspace.value)
    }
    const search = params.toString()
    await router.replace(search ? `${route.path}?${search}` : route.path)
  }

  return {
    route,
    queryWorkspace,
    pageAction,
    currentPage,
    switchLink,
    selectWorkspace,
    clearPageAction,
  }
}
