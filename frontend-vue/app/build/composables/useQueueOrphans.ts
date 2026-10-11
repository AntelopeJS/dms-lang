import type { FlatTranslations } from '../../types/lang'
import type { QueueSession } from '../../composables/translation/useQueueSession'
import type { DraftCheck, DraftId } from '../../utils/queueDrafts'
import { useQueueToasts } from './useQueueToasts'

/** What is known to exist, for telling which drafts lost their key. */
interface LiveTargets {
  /** The workspaces of the module; none while the list is not in. */
  workspaces: Set<string> | null
  /** The translations of the workspace shown; none while they are not in. */
  flat: FlatTranslations | null
  selected: string
}

function goneCheck(targets: LiveTargets): DraftCheck {
  const keys = new Set(targets.flat?.rows.map((row) => row.key))
  const languages = new Set(targets.flat?.locales)
  const isKeyGone = (id: DraftId) =>
    !!targets.flat && (!languages.has(id.locale) || !keys.has(id.key))
  return (id) => {
    if (targets.workspaces && !targets.workspaces.has(id.workspace)) return true
    return id.workspace === targets.selected && isKeyGone(id)
  }
}

/**
 * Takes out the drafts whose key, language or workspace was deleted or
 * renamed elsewhere, each with a toast that offers to copy it: nothing asks
 * to discard them later, and no link leads to a workspace that is gone.
 */
export function useQueueOrphans(session: QueueSession) {
  const { flat, isLoaded } = useWorkspaceFlat()
  const {
    workspaces,
    isLoaded: hasWorkspaces,
    selectedWorkspace,
  } = useI18nWorkspaces()
  const { announceDeleted } = useQueueToasts()
  watch(
    [flat, isLoaded, workspaces, hasWorkspaces],
    () => {
      const isGone = goneCheck({
        workspaces: hasWorkspaces.value
          ? new Set(workspaces.value.map((workspace) => workspace.id))
          : null,
        flat: isLoaded.value ? flat.value : null,
        selected: selectedWorkspace.value,
      })
      for (const orphan of session.drafts.take(isGone))
        announceDeleted(orphan.key, orphan.value)
    },
    { immediate: true },
  )
}
