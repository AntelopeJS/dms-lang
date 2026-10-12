import type { ScopedWorkspace, WorkspacePermission } from '../../types/lang'

/**
 * Read-only view of the selected workspace and of what the current user may
 * do with it, shared by every page of the module.
 */
export const useWorkspaceContext = () => {
  const { workspaces, editable, selectedWorkspace, isLoaded, permissions } =
    useI18nWorkspaces()
  const { hasPermission } = usePermissions()

  const current = computed<ScopedWorkspace | null>(
    () =>
      workspaces.value.find(
        (workspace) => workspace.id === selectedWorkspace.value,
      ) ?? null,
  )

  /** The URL names a workspace the server does not have. */
  const isUnknown = computed(
    () => isLoaded.value && !!selectedWorkspace.value && !current.value,
  )
  /** The workspace is in, with its figures. */
  const isResolved = computed(() => current.value !== null)

  const isDefault = computed(() => current.value?.kind === 'default')
  const isModules = computed(() => current.value?.kind === 'modules')
  const isAdded = computed(() => current.value?.kind === 'added')
  const isEditable = computed(
    () => editable.value && (current.value?.editable ?? false),
  )
  const canEditValues = computed(() => isEditable.value && !isModules.value)
  const canManage = computed(() => isAdded.value && isEditable.value)

  /** Whether the user holds the DMS permission guarding a kind of write. */
  function allows(permission: WorkspacePermission): boolean {
    const id = permissions.value?.[permission]
    return id ? hasPermission(id) : true
  }

  const canManageKeys = computed(
    () => canEditValues.value && allows('manageKeys'),
  )

  return {
    current,
    isUnknown,
    isResolved,
    isDefault,
    isModules,
    isAdded,
    isEditable,
    canEditValues,
    canManage,
    canManageKeys,
    allows,
  }
}
