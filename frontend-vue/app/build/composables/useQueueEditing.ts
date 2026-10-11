import type { QueueSession } from '../../composables/translation/useQueueSession'
import {
  checkMessage,
  hasBlockingIssue,
  stringValue,
} from '../../utils/translations'

/**
 * The text of the key shown in the queue: its base text, the saved text, the
 * draft typed over it and what is wrong with that draft.
 */
export function useQueueEditing(session: QueueSession) {
  const { current, locale, baseLocale, drafts } = session
  const baseText = computed(() =>
    stringValue(current.value?.values[baseLocale.value]),
  )
  const savedText = computed(() =>
    stringValue(current.value?.values[locale.value]),
  )
  const draft = computed<string>({
    get: () => {
      const stored = current.value ? drafts.read(current.value.key) : undefined
      return stored ?? savedText.value
    },
    set: (value) => {
      if (!current.value) return
      drafts.write(current.value.key, value, current.value.values[locale.value])
    },
  })
  const issues = computed(() => checkMessage(baseText.value, draft.value))
  return {
    baseText,
    savedText,
    draft,
    issues,
    isBlocked: computed(() => hasBlockingIssue(issues.value)),
    /**
     * The value saved elsewhere since the draft was started (a conflict):
     * shown with the choice to keep it or to save the draft over it.
     */
    conflict: computed(() =>
      current.value && session.isStale(current.value)
        ? savedText.value
        : undefined,
    ),
    /** The base text changed since this translation was written. */
    isOutdated: computed(
      () => !!current.value && session.isOutdated(current.value),
    ),
  }
}

export type QueueEditing = ReturnType<typeof useQueueEditing>
