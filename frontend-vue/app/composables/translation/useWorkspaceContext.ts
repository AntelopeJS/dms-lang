import type { WorkspaceSummary } from '../../types/lang'

/**
 * Read-only view of the selected workspace and of what the current user may
 * do with it, shared by every page of the module.
 */
export const useWorkspaceContext = () => {
  const { workspaces, editable, selectedWorkspace } = useI18nWorkspaces()

  const current = computed<WorkspaceSummary | null>(
    () =>
      workspaces.value.find(
        (workspace) => workspace.id === selectedWorkspace.value,
      ) ?? null,
  )

  const isDefault = computed(() => current.value?.kind === 'default')
  const isModules = computed(() => current.value?.kind === 'modules')
  const isAdded = computed(() => current.value?.kind === 'added')
  const isEditable = computed(
    () => editable.value && (current.value?.editable ?? false),
  )
  const canEditValues = computed(() => isEditable.value && !isModules.value)
  const canManage = computed(() => isAdded.value && isEditable.value)

  return {
    current,
    isDefault,
    isModules,
    isAdded,
    isEditable,
    canEditValues,
    canManage,
  }
}
