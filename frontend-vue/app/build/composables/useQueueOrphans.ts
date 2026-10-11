import type { FlatTranslations } from '../../types/lang'
import type { QueueSession } from '../../composables/translation/useQueueSession'
import type { DraftCheck, DraftId } from '../../utils/queueDrafts'
import { useQueueToasts } from './useQueueToasts'

function goneCheck(flat: FlatTranslations, selected: string): DraftCheck {
  const keys = new Set(flat.rows.map((row) => row.key))
  const languages = new Set(flat.locales)
  const isKeyGone = (id: DraftId) =>
    !languages.has(id.locale) || !keys.has(id.key)
  return (id) => id.workspace === selected && isKeyGone(id)
}

/**
 * Takes out the drafts of the workspace shown whose key or language was
 * deleted elsewhere, each with a toast that offers to copy it: nothing asks
 * to discard them later.
 */
export function useQueueOrphans(session: QueueSession) {
  const { flat, isLoaded } = useWorkspaceFlat()
  const { selectedWorkspace } = useI18nWorkspaces()
  const { announceDeleted } = useQueueToasts()
  watch(
    [flat, isLoaded],
    () => {
      if (!isLoaded.value) return
      const isGone = goneCheck(flat.value, selectedWorkspace.value)
      for (const orphan of session.drafts.take(isGone))
        announceDeleted(orphan.key, orphan.value)
    },
    { immediate: true },
  )
}
