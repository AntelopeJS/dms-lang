import type { ComputedRef, Ref } from 'vue'
import type { FlatTranslationRow } from '../../types/lang'
import { savedText } from '../../utils/keySaves'
import {
  EMPTY_PASS,
  advancePass,
  completeKey,
  currentKey,
  goToIndex,
  pendingAfter,
  pendingKeys,
  previousKey,
  skipCurrent,
  startPass,
  type KeyIsOpen,
  type QueueChange,
  type QueuePass,
  type QueueStep,
} from '../../utils/queuePass'
import type { QueueDraftStore } from './useQueueDrafts'
import type { LanguageQueue } from './useLanguageQueue'

export interface QueueEntry {
  row: FlatTranslationRow
  index: number
  isSkipped: boolean
}

type RowsByKey = ComputedRef<Map<string, FlatTranslationRow>>

/** What the pass shows: the key shown, the keys left and the next ones. */
function passView(
  pass: Ref<QueuePass>,
  rowsByKey: RowsByKey,
  isOpen: KeyIsOpen,
  upNextSize: number,
) {
  const pending = computed(() => pendingKeys(pass.value, isOpen))
  const current = computed(() => {
    const key = currentKey(pass.value)
    return key === undefined ? undefined : rowsByKey.value.get(key)
  })
  const statusOf = (key: string) => pass.value.status[key]
  const upNext = computed<QueueEntry[]>(() =>
    pendingAfter(pass.value, pass.value.cursor, isOpen)
      .slice(0, upNextSize)
      .flatMap((index) => {
        const row = rowsByKey.value.get(pass.value.order[index])
        if (!row) return []
        return [{ row, index, isSkipped: statusOf(row.key) === 'skipped' }]
      }),
  )
  return {
    pending,
    current,
    upNext,
    currentStatus: computed(() =>
      current.value ? statusOf(current.value.key) : undefined,
    ),
    skippedCount: computed(
      () => pending.value.filter((key) => statusOf(key) === 'skipped').length,
    ),
    progress: computed(() =>
      coveragePercent(
        pass.value.order.length - pending.value.length,
        pass.value.order.length,
      ),
    ),
  }
}

/** The moves of a pass, each one applied to `pass`. */
function passMoves(pass: Ref<QueuePass>, isOpen: KeyIsOpen) {
  const apply = (change: QueueChange): QueueStep | undefined => {
    pass.value = change.pass
    return change.step
  }
  return {
    skip: () => apply(skipCurrent(pass.value, isOpen)),
    /** Marks a key saved; moves on when it is the one shown, unless `shouldAdvance` is false. */
    complete: (key: string, shouldAdvance = true) =>
      apply(completeKey(pass.value, key, shouldAdvance, isOpen)),
    previous: () => apply({ pass: previousKey(pass.value) }),
    goTo: (index: number) => apply({ pass: goToIndex(pass.value, index) }),
    advance: () => apply(advancePass(pass.value, isOpen)),
  }
}

function isStaleDraft(
  drafts: QueueDraftStore,
  locale: Ref<string>,
  row: FlatTranslationRow,
): boolean {
  const start = drafts.startOf(row.key)
  return start !== undefined && start !== savedText(row.values[locale.value])
}

/**
 * One pass through the queue: the keys it holds are fixed when it starts (a
 * saved key stays in it, so Previous goes back to it), each one done, skipped
 * or still to do. Skipped keys come back once the others are done, and the
 * pass only ends when none is left. Drafts are kept per key until saved.
 */
export const useQueueSession = (upNextSize: number) => {
  const language = useLanguageQueue()
  const { flat } = useWorkspaceFlat()
  const drafts = useQueueDrafts(language.locale)
  const pass = ref<QueuePass>(EMPTY_PASS)
  const rowsByKey = computed(
    () => new Map(flat.value.rows.map((row) => [row.key, row])),
  )
  const isOpen = (key: string) => {
    const row = rowsByKey.value.get(key)
    return !!row && (language.matchesMode(row) || drafts.has(key))
  }
  const view = passView(pass, rowsByKey, isOpen, upNextSize)
  const moves = passMoves(pass, isOpen)
  /** Starts a new pass, on `key` when it is in it, with the keys holding a draft. */
  const start = (key = '') => {
    pass.value = startPass(
      language.passOf((row) => drafts.has(row.key)),
      key,
      isOpen,
    )
  }
  useSessionWatchers(language, view.current, pass, {
    start,
    advance: moves.advance,
  })
  return {
    ...language,
    ...view,
    ...moves,
    drafts,
    isStale: (row: FlatTranslationRow) =>
      isStaleDraft(drafts, language.locale, row),
    isFinished: computed(() => pass.value.isFinished),
    canGoBack: computed(() => pass.value.history.length > 0),
    start,
  }
}

/** What restarts or moves the pass on its own. */
interface SessionSteps {
  start: (key?: string) => void
  advance: () => QueueStep | undefined
}

/**
 * Starts a new pass whenever the workspace, the language, the mode or the
 * namespace changes (on the key in the URL), and moves on when the key shown
 * leaves the translations (deleted elsewhere).
 */
function useSessionWatchers(
  language: LanguageQueue,
  current: ComputedRef<FlatTranslationRow | undefined>,
  pass: Ref<QueuePass>,
  steps: SessionSteps,
) {
  const { isLoaded } = useWorkspaceFlat()
  const { selectedWorkspace } = useI18nWorkspaces()
  const { route } = useWorkspaceRoute()
  watch(
    [
      selectedWorkspace,
      language.locale,
      language.mode,
      language.namespace,
      isLoaded,
    ],
    () => {
      if (isLoaded.value) steps.start(route.query.key)
    },
    { immediate: true },
  )
  watch(current, (row) => {
    if (!row && !pass.value.isFinished && pass.value.order.length)
      steps.advance()
  })
}

export type QueueSession = ReturnType<typeof useQueueSession>
