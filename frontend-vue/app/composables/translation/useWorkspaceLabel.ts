import type { WorkspaceSummary } from '../../types/lang'

/** What naming a workspace needs. */
type NamedWorkspace = Pick<WorkspaceSummary, 'id' | 'kind'>

/**
 * The name a sentence gives a workspace: the label of its kind ("Project
 * files"), or its id for an added one. Never the bare id of the project or
 * modules workspace, which reads as an untranslated word.
 */
export const useWorkspaceLabel = () => {
  const { t } = useI18n()
  const { selectedWorkspace } = useI18nWorkspaces()
  const { current } = useWorkspaceContext()

  function labelOf(workspace: NamedWorkspace): string {
    return t(`dms_lang.workspace_kinds.${workspace.kind}.label`, {
      name: workspace.id,
    })
  }

  /** The name of the selected workspace, its id until the list is in. */
  const label = computed(() =>
    current.value ? labelOf(current.value) : selectedWorkspace.value,
  )

  return { label, labelOf }
}
