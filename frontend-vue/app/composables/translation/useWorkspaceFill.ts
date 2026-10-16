import { useDmsRouter, useDmsState } from '#dms/frontend-module'

/**
 * Gives a page opened without `?workspace=` (a menu link, a new tab) the
 * workspace remembered, or the project files once that one turns out to be
 * gone. A server render redirects to it, so the page renders its data at
 * once; call it once the workspace list is in, which a server render awaits.
 */
export const useWorkspaceFill = () => {
  const router = useDmsRouter()
  const { workspaces, isLoaded, selectedWorkspace } = useI18nWorkspaces()
  const { isUnknown } = useWorkspaceContext()
  const { route, queryWorkspace, pageAction } = useWorkspaceRoute()
  const filledFromMemory = useDmsState<string>(
    'dms-lang-workspace-filled',
    () => '',
  )

  function fillWorkspace(workspace: string): void {
    void router.replace(
      linkWithQuery(route.path, { ...route.query, workspace }),
    )
  }

  watch(
    [queryWorkspace, pageAction],
    ([workspace, action]) => {
      if (workspace || action) return
      const isKnown = workspaces.value.some(
        (entry) => entry.id === selectedWorkspace.value,
      )
      const fallback =
        isKnown || !isLoaded.value ? selectedWorkspace.value : DEFAULT_WORKSPACE
      filledFromMemory.value = fallback
      fillWorkspace(fallback)
    },
    { immediate: true },
  )

  watch(
    [isUnknown, queryWorkspace],
    ([unknown, workspace]) => {
      if (import.meta.env.SSR || !unknown) return
      if (!workspace || workspace !== filledFromMemory.value) return
      filledFromMemory.value = ''
      fillWorkspace(DEFAULT_WORKSPACE)
    },
    { immediate: true },
  )
}
