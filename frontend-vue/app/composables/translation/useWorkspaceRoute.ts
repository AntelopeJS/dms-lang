import { useDmsRoute, useDmsRouter } from '#dms/frontend-module'

/**
 * Keeps the selected workspace in the page URL (`?workspace=`): a shared link
 * or a refresh lands on the same workspace, and the page reacts when the
 * query changes. Also reads the dialog a page was asked to open on arrival.
 */
export const useWorkspaceRoute = () => {
  const route = useDmsRoute()
  const router = useDmsRouter()
  const { selectedWorkspace, isLoaded, isLoading, fetchWorkspaces } =
    useI18nWorkspaces()

  const queryWorkspace = computed(() => route.query.workspace || '')
  const pageAction = computed(() => route.query[PAGE_ACTION_QUERY] || '')

  watch(
    queryWorkspace,
    (workspace) => {
      if (workspace) selectedWorkspace.value = workspace
    },
    { immediate: true },
  )

  onMounted(() => {
    if (!isLoaded.value && !isLoading.value) fetchWorkspaces()
  })

  function switchLink(workspace: string): string {
    const params = new URLSearchParams(route.query)
    params.set('workspace', workspace)
    params.delete(PAGE_ACTION_QUERY)
    return `${route.path}?${params.toString()}`
  }

  async function clearPageAction(): Promise<void> {
    if (!pageAction.value) return
    const params = new URLSearchParams(route.query)
    params.delete(PAGE_ACTION_QUERY)
    const search = params.toString()
    await router.replace(search ? `${route.path}?${search}` : route.path)
  }

  return { route, queryWorkspace, pageAction, switchLink, clearPageAction }
}
