import type { ComputedRef, Ref } from 'vue'
import type { FlatTranslationRow } from '../../types/lang'
import type { QueueSession } from '../../composables/translation/useQueueSession'
import type { KeySaveFailureKind } from '../../utils/keySaveErrors'
import { savedText as expectedTextOf, storedText } from '../../utils/keySaves'
import { DRAFT_SEPARATOR } from '../../utils/queueDrafts'
import type { QueueEditing } from './useQueueEditing'
import { useKeySaves, type KeyWriteFailed } from './useKeySaves'
import { useQueueToasts } from './useQueueToasts'

/** A text the server refused, with its problems. */
interface Rejection {
  key: string
  value: string
  problems: string[]
}

/** A save on its way: the text typed and the text it stores. */
interface QueueWrite {
  row: FlatTranslationRow
  typed: string
  value: string
  shouldAdvance: boolean
}

interface QueueSaveState {
  isSaving: Ref<boolean>
  isReviewing: Ref<boolean>
  armed: Ref<string>
  rejection: Ref<Rejection | null>
}

interface QueueSaveContext {
  session: QueueSession
  editing: QueueEditing
  state: QueueSaveState
  saves: ReturnType<typeof useKeySaves>
  toasts: ReturnType<typeof useQueueToasts>
  failures: ReturnType<typeof useMutationToast>
  workspace: Ref<string>
  canEdit: Ref<boolean>
  languageName: ComputedRef<string>
  t: ReturnType<typeof useI18n>['t']
  confirm: ReturnType<typeof useConfirm>['confirm']
}

type SaveFailureHandler = (
  context: QueueSaveContext,
  write: QueueWrite,
  outcome: KeyWriteFailed,
) => void

function armId(key: string, value: string): string {
  return [key, value].join(DRAFT_SEPARATOR)
}

function isArmedFor(context: QueueSaveContext, key: string): boolean {
  return context.state.armed.value === armId(key, context.editing.draft.value)
}

/** Drops a key deleted elsewhere, its draft offered in a toast. */
function onDeleted(context: QueueSaveContext, row: FlatTranslationRow) {
  const { session, saves, toasts, workspace } = context
  const draftText = session.drafts.read(row.key)
  session.drafts.drop(row.key)
  saves.dropRow({ workspace: workspace.value, key: row.key })
  toasts.announceDeleted(row.key, draftText)
}

function onInvalid(
  context: QueueSaveContext,
  write: QueueWrite,
  outcome: KeyWriteFailed,
) {
  const { details } = outcome.failure
  context.state.rejection.value = {
    key: write.row.key,
    value: context.session.drafts.read(write.row.key) ?? write.typed,
    problems: details.length ? details : [outcome.message],
  }
}

const SAVE_FAILURES: Record<KeySaveFailureKind, SaveFailureHandler> = {
  conflict: (context, write) => context.toasts.warnConflict(write.row.key),
  deleted: (context, write) => onDeleted(context, write.row),
  invalid: onInvalid,
  other: (context, write, outcome) =>
    context.failures.reportFailure(outcome.error, {
      title: context.t('dms_lang.matrix.save_failed', {
        key: write.row.key,
        code: context.session.locale.value,
      }),
      retry: () => void send(context, write),
    }),
}

/**
 * Sends a text, expecting the one its draft started on. Once saved, a text
 * typed during the save stays as a draft, and the queue stays on its key.
 */
async function send(context: QueueSaveContext, write: QueueWrite) {
  const { session, state, saves, workspace } = context
  const { row, typed, value } = write
  const code = session.locale.value
  const start = session.drafts.startOf(row.key)
  state.isSaving.value = true
  const outcome = await saves.write({
    workspace: workspace.value,
    key: row.key,
    values: { [code]: value },
    expected: {
      [code]: start === undefined ? expectedTextOf(row.values[code]) : start,
    },
  })
  state.isSaving.value = false
  if (outcome.status === 'failed')
    return SAVE_FAILURES[outcome.failure.kind](context, write, outcome)
  const isTypedMeanwhile =
    session.drafts.read(row.key) !== undefined &&
    session.drafts.read(row.key) !== typed
  session.drafts.settle(row.key, { typed, stored: storedText(value) })
  const step = session.complete(
    row.key,
    write.shouldAdvance && !isTypedMeanwhile,
  )
  context.toasts.showStep(step)
}

function confirmClear(context: QueueSaveContext, row: FlatTranslationRow) {
  const { t } = context
  const name = context.languageName.value
  return context.confirm({
    title: t('dms_lang.queue.clear_title', { name, key: row.key }),
    description: t('dms_lang.queue.clear_description', { name }),
    color: 'warning',
    icon: 'i-ph-eraser',
    confirmLabel: t('dms_lang.queue.clear_submit'),
    initialFocus: 'cancel',
  })
}

/** Why the draft cannot be saved yet, said in a toast; none when it can. */
function holdBack(context: QueueSaveContext, key: string): boolean {
  const { editing, toasts, state } = context
  if (editing.conflict.value !== undefined) {
    toasts.warnConflict(key)
    return true
  }
  if (editing.isBlocked.value) {
    toasts.warnBlocked()
    return true
  }
  if (!editing.issues.value.length || isArmedFor(context, key)) return false
  state.armed.value = armId(key, editing.draft.value)
  return true
}

/** A draft back to the saved text: nothing to send, the key is done (or skipped when empty). */
function settleUnchanged(
  context: QueueSaveContext,
  row: FlatTranslationRow,
  value: string,
  shouldAdvance: boolean,
) {
  const { session, toasts } = context
  session.drafts.drop(row.key)
  if (value) return toasts.showStep(session.complete(row.key, shouldAdvance))
  if (shouldAdvance) toasts.showStep(session.skip())
}

/**
 * Saves the draft of the key shown, then moves on unless `shouldAdvance` is
 * false. A draft with issues asks for a second press; an empty one asks
 * before clearing the text.
 */
async function save(context: QueueSaveContext, shouldAdvance: boolean) {
  const { session, editing, state } = context
  const row = session.current.value
  if (!row || state.isSaving.value || !context.canEdit.value) return
  const typed = editing.draft.value
  const value = normalizeDraft(typed)
  if (value === editing.savedText.value)
    return settleUnchanged(context, row, value, shouldAdvance)
  if (holdBack(context, row.key)) return
  if (!value && !(await confirmClear(context, row))) return
  await send(context, { row, typed, value, shouldAdvance })
}

/** Acknowledges "To review" without changing the text, then moves on. */
async function markReviewed(context: QueueSaveContext) {
  const { session, state, saves, workspace, t } = context
  const row = session.current.value
  if (!row || state.isReviewing.value) return
  state.isReviewing.value = true
  const code = session.locale.value
  const outcome = await saves.markReviewed(
    { workspace: workspace.value, key: row.key },
    code,
  )
  state.isReviewing.value = false
  if (outcome.status === 'failed') {
    if (outcome.failure.kind === 'deleted') return onDeleted(context, row)
    return context.failures.reportFailure(outcome.error)
  }
  context.toasts.notify(t('dms_lang.drawer.reviewed', { code, key: row.key }))
  context.toasts.showStep(session.complete(row.key))
}

function saveState(): QueueSaveState {
  return {
    isSaving: ref(false),
    isReviewing: ref(false),
    armed: ref(''),
    rejection: ref<Rejection | null>(null),
  }
}

function rejectedProblems(context: QueueSaveContext): string[] {
  const rejected = context.state.rejection.value
  const row = context.session.current.value
  if (!rejected || rejected.key !== row?.key) return []
  return rejected.value === context.editing.draft.value ? rejected.problems : []
}

/** What the queue's save offers its editor: the state and the actions. */
function saveActions(context: QueueSaveContext) {
  const { session, state } = context
  const current = () => session.current.value
  return {
    ...state,
    isArmed: computed(() => {
      const row = current()
      return !!row && isArmedFor(context, row.key)
    }),
    rejectedProblems: computed(() => rejectedProblems(context)),
    save: () => save(context, true),
    /** Saves the draft and stays on its key (nothing to do without a draft). */
    saveInPlace: () => {
      const row = current()
      if (row && session.drafts.has(row.key)) void save(context, false)
    },
    /** Keeps the value saved elsewhere: the draft goes. */
    useTheirs: () => {
      const row = current()
      if (row) session.drafts.drop(row.key)
    },
    /** Saves the draft over the value saved elsewhere meanwhile. */
    overwrite: () => {
      const row = current()
      if (!row) return
      session.drafts.rebase(row.key, row.values[session.locale.value])
      void save(context, true)
    },
    markReviewed: () => markReviewed(context),
  }
}

/**
 * The save protocol of the translation queue, on the module's one save
 * engine (`useKeySaves`): a draft expects the text it started on, a refused
 * write says why (conflict, deleted key, invalid message) and a text typed
 * during a save is kept.
 */
export function useQueueSave(
  session: QueueSession,
  editing: QueueEditing,
  languageName: ComputedRef<string>,
) {
  const { selectedWorkspace } = useI18nWorkspaces()
  const { canEditValues } = useWorkspaceContext()
  const context: QueueSaveContext = {
    session,
    editing,
    languageName,
    state: saveState(),
    saves: useKeySaves(),
    toasts: useQueueToasts(),
    failures: useMutationToast(),
    workspace: selectedWorkspace,
    canEdit: canEditValues,
    t: useI18n().t,
    confirm: useConfirm().confirm,
  }
  watch([selectedWorkspace, session.locale], () => {
    context.state.armed.value = ''
  })
  return saveActions(context)
}

export type QueueSave = ReturnType<typeof useQueueSave>
