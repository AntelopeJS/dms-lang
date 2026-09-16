import type { WorkspaceSummary } from "./useI18nWorkspaces";

/**
 * Read-only view of the globally selected workspace and of what the current
 * user may do with it, shared by every page and widget of the module.
 */
export const useWorkspaceContext = () => {
  const { workspaces, editable, selectedWorkspace } = useI18nWorkspaces();

  const current = computed(
    () =>
      workspaces.value.find(
        (workspace: WorkspaceSummary) =>
          workspace.id === selectedWorkspace.value,
      ) ?? null,
  );

  const isDefault = computed(() => current.value?.kind === "default");
  const isModules = computed(() => current.value?.kind === "modules");
  const isAdded = computed(() => current.value?.kind === "added");
  const isEditable = computed(
    () => editable.value && (current.value?.editable ?? false),
  );
  const canManage = computed(() => isAdded.value && isEditable.value);

  return { current, isDefault, isModules, isAdded, isEditable, canManage };
};
