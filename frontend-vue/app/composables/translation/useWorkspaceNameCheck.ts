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

/** Checks a workspace name as it is typed, before anything is sent. */
export const useWorkspaceNameCheck = (name: Ref<string>, currentId = '') => {
  const { t } = useI18n()
  const { workspaces } = useI18nWorkspaces()

  const normalized = computed(() => normalizeWorkspaceId(name.value))

  const state = computed<WorkspaceNameState>(() => {
    const id = normalized.value
    if (!id) return 'empty'
    if (id === currentId) return 'unchanged'
    if (!isValidWorkspaceId(id)) return 'invalid'
    if (workspaces.value.some((workspace) => workspace.id === id))
      return 'taken'
    return 'available'
  })

  const message = computed(() =>
    t(STATE_MESSAGES[state.value], { name: normalized.value }),
  )
  const isValid = computed(() => state.value === 'available')
  const isError = computed(
    () => state.value === 'invalid' || state.value === 'taken',
  )

  return { normalized, state, message, isValid, isError }
}
