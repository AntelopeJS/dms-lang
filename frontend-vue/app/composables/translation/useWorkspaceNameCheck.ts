import type { Ref } from 'vue'

export type WorkspaceNameState =
  'empty' | 'invalid' | 'taken' | 'unchanged' | 'available'

const STATE_MESSAGES: Record<WorkspaceNameState, string> = {
  empty: 'dms_lang.workspace_name.help',
  invalid: 'dms_lang.workspace_name.invalid',
  taken: 'dms_lang.workspace_name.taken',
  unchanged: 'dms_lang.workspace_name.unchanged',
  available: 'dms_lang.workspace_name.available',
}

/**
 * Checks a workspace name as it is typed, before anything is sent. Ids are
 * compared without case, as the server does. `freeze()` keeps the verdict
 * once the name is sent: the list reloaded after a creation must not turn
 * the closing dialog red with "already exists".
 */
export const useWorkspaceNameCheck = (name: Ref<string>, currentId = '') => {
  const { t } = useI18n()
  const { workspaces } = useI18nWorkspaces()

  const normalized = computed(() => normalizeWorkspaceId(name.value))
  const frozenState = ref<WorkspaceNameState | null>(null)

  const liveState = computed<WorkspaceNameState>(() => {
    const id = normalized.value
    if (!id) return 'empty'
    if (id === normalizeWorkspaceId(currentId)) return 'unchanged'
    if (!isValidWorkspaceId(id)) return 'invalid'
    if (workspaces.value.some((workspace) => workspace.id.toLowerCase() === id))
      return 'taken'
    return 'available'
  })
  const state = computed(() => frozenState.value ?? liveState.value)

  function freeze(): void {
    frozenState.value = liveState.value
  }

  function thaw(): void {
    frozenState.value = null
  }

  const message = computed(() =>
    t(STATE_MESSAGES[state.value], { name: normalized.value }),
  )
  const isValid = computed(() => state.value === 'available')
  const isError = computed(
    () => state.value === 'invalid' || state.value === 'taken',
  )

  return { normalized, state, message, isValid, isError, freeze, thaw }
}
