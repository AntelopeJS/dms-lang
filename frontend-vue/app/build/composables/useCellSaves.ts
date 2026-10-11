import type { Ref } from 'vue'
import { useDmsState } from '#dms/frontend-module'
import type { FlatTranslationRow } from '../../types/lang'
import {
  saveIdOf,
  saveIdPrefix,
  savedText,
  storedText,
  withEntry,
  type ExpectedText,
  type SaveState,
} from '../../utils/keySaves'
import {
  useEditStarts,
  useKeySaves,
  useSaveStates,
  type KeyWriteFailed,
  type KeyWriteOutcome,
} from './useKeySaves'

export interface CellFailure {
  /** The text that could not be saved: kept until saved or discarded. */
  draft: string
  message: string
  /** Someone changed the cell meanwhile: retrying overwrites their text. */
  isConflict: boolean
  /** What the next attempt expects: the value sent, or the other's text after a conflict. */
  expected: ExpectedText
}

/** One cell of one workspace. */
export interface CellAddress {
  workspace: string
  key: string
  code: string
}

/** A text of a cell that could not be saved, handed over to its cell. */
export interface CellHold extends CellAddress, CellFailure {}

interface KeptText extends CellAddress {
  draft: string
  message: string
}

interface CellStore {
  states: Ref<Record<string, SaveState>>
  pending: Ref<Record<string, string>>
  failures: Ref<Record<string, CellFailure>>
}

interface CellContext {
  store: CellStore
  saves: ReturnType<typeof useKeySaves>
  states: ReturnType<typeof useSaveStates>
  report: ReturnType<typeof useCellReports>
  onTouched: (address: CellAddress) => void
}

function idOfCell(address: CellAddress): string {
  return saveIdOf(address.workspace, address.key, address.code)
}

function useCellStore(): CellStore {
  return {
    states: useDmsState<Record<string, SaveState>>(
      'dms-lang-matrix-cell-states',
      () => ({}),
    ),
    pending: useDmsState<Record<string, string>>(
      'dms-lang-matrix-cell-pending',
      () => ({}),
    ),
    failures: useDmsState<Record<string, CellFailure>>(
      'dms-lang-matrix-cell-failures',
      () => ({}),
    ),
  }
}

function setPending(store: CellStore, id: string, value: string | undefined) {
  store.pending.value = withEntry(store.pending.value, id, value)
}

function setFailure(
  store: CellStore,
  id: string,
  failure: CellFailure | undefined,
) {
  store.failures.value = withEntry(store.failures.value, id, failure)
}

function failureExpected(
  address: CellAddress,
  outcome: KeyWriteFailed,
): ExpectedText {
  const { current, kind } = outcome.failure
  const isOverwritable = kind === 'conflict' && address.code in current
  return isOverwritable
    ? savedText(current[address.code])
    : outcome.expected[address.code]
}

function recordFailure(
  context: CellContext,
  address: CellAddress,
  draft: string,
  outcome: KeyWriteFailed,
) {
  const id = idOfCell(address)
  const isConflict = outcome.failure.kind === 'conflict'
  setPending(context.store, id, undefined)
  setFailure(context.store, id, {
    draft,
    message: outcome.message,
    isConflict,
    expected: failureExpected(address, outcome),
  })
  context.states.setState(id, 'error')
  if (outcome.failure.kind === 'deleted') context.saves.dropRow(address)
  if (isConflict) context.report.conflict(address, outcome.message)
  else context.report.failure(address, outcome.error)
}

function settle(
  context: CellContext,
  address: CellAddress,
  draft: string,
  outcome: KeyWriteOutcome,
) {
  const id = idOfCell(address)
  if (context.store.pending.value[id] !== draft) return
  if (outcome.status === 'failed')
    return recordFailure(context, address, draft, outcome)
  setPending(context.store, id, undefined)
  context.states.flashSaved(id)
}

async function queueSave(
  context: CellContext,
  address: CellAddress,
  draft: string,
  expected: ExpectedText,
) {
  const id = idOfCell(address)
  context.onTouched(address)
  setFailure(context.store, id, undefined)
  setPending(context.store, id, draft)
  context.states.setState(id, 'saving')
  const outcome = await context.saves.write({
    workspace: address.workspace,
    key: address.key,
    values: { [address.code]: draft },
    expected: { [address.code]: expected },
  })
  settle(context, address, draft, outcome)
}

function useCellReports(
  retry: (address: CellAddress) => void,
  discard: (address: CellAddress) => void,
) {
  const { t } = useI18n()
  const toast = useToast()
  const { reportFailure } = useMutationToast()

  return {
    conflict(address: CellAddress, message: string) {
      toast.add({
        title: t('dms_lang.matrix.conflict', { ...address }),
        description: message,
        color: 'error',
        icon: 'i-ph-warning-circle',
        actions: [
          {
            label: t('dms_lang.matrix.discard'),
            color: 'neutral',
            variant: 'outline',
            onClick: () => discard(address),
          },
          {
            label: t('dms_lang.matrix.overwrite'),
            onClick: () => retry(address),
          },
        ],
      })
    },
    failure(address: CellAddress, error: unknown, canRetry = true) {
      reportFailure(error, {
        title: t('dms_lang.matrix.save_failed', { ...address }),
        retry: canRetry ? () => retry(address) : undefined,
      })
    },
  }
}

function useCellView(
  store: CellStore,
  states: ReturnType<typeof useSaveStates>,
) {
  return {
    hasUnsaved: computed(
      () =>
        Object.keys(store.failures.value).length > 0 ||
        Object.keys(store.pending.value).length > 0,
    ),
    /** The text a cell shows: the one being saved, else the stored one. */
    shownValue: (address: CellAddress, stored: string): string =>
      store.pending.value[idOfCell(address)] ?? stored,
    stateOf: (address: CellAddress) => states.stateOf(idOfCell(address)),
    failureOf: (address: CellAddress): CellFailure | undefined =>
      store.failures.value[idOfCell(address)],
    isPending(address: CellAddress): boolean {
      const id = idOfCell(address)
      return id in store.pending.value || id in store.failures.value
    },
    /** A text of the row that could not be saved: the row is not done. */
    hasRowFailure: (workspace: string, key: string): boolean =>
      Object.keys(store.failures.value).some((id) =>
        id.startsWith(saveIdPrefix(workspace, key)),
      ),
  }
}

function useCellStarts(
  store: CellStore,
  rowOf: (address: CellAddress) => FlatTranslationRow | undefined,
) {
  const starts = useEditStarts()

  function expectedNow(address: CellAddress): ExpectedText {
    const id = idOfCell(address)
    const failure = store.failures.value[id]
    if (failure) return failure.expected
    const typed = store.pending.value[id]
    if (typed !== undefined) return storedText(typed)
    const row = rowOf(address)
    return row ? savedText(row.values[address.code]) : undefined
  }

  function take(address: CellAddress): ExpectedText {
    const id = idOfCell(address)
    const expected = starts.has(id) ? starts.of(id) : expectedNow(address)
    starts.end(id)
    return expected
  }

  return { starts, expectedNow, take }
}

function changedElsewhere(
  store: CellStore,
  starts: ReturnType<typeof useEditStarts>,
  address: CellAddress,
  row: FlatTranslationRow | undefined,
): string | undefined {
  const id = idOfCell(address)
  if (!starts.has(id) || id in store.pending.value || !row) return undefined
  const current = savedText(row.values[address.code])
  return current === starts.of(id) ? undefined : (current ?? '')
}

function keepCell(
  context: CellContext,
  starts: ReturnType<typeof useEditStarts>,
  kept: KeptText,
) {
  const id = idOfCell(kept)
  const expected = starts.has(id) ? starts.of(id) : undefined
  starts.end(id)
  const { draft, message } = kept
  setFailure(context.store, id, { draft, message, isConflict: false, expected })
  context.states.setState(id, 'error')
}

function holdCell(context: CellContext, hold: CellHold) {
  const { workspace, key, code, ...failure } = hold
  const id = idOfCell({ workspace, key, code })
  setFailure(context.store, id, failure)
  context.states.setState(id, 'error')
}

function retryCell(context: CellContext, address: CellAddress) {
  const failure = context.store.failures.value[idOfCell(address)]
  if (failure) void queueSave(context, address, failure.draft, failure.expected)
}

function discardCell(context: CellContext, address: CellAddress) {
  const id = idOfCell(address)
  setFailure(context.store, id, undefined)
  context.states.setState(id, 'idle')
}

async function markCellReviewed(context: CellContext, address: CellAddress) {
  const outcome = await context.saves.markReviewed(address, address.code)
  if (outcome.status === 'failed')
    context.report.failure(address, outcome.error, false)
}

/**
 * Saves matrix cells one by one, as soon as they are left: the typed text
 * shows at once with a "Saving" state, and a text that could not be saved
 * stays on screen until it is saved or discarded, also after the page was
 * left for another workspace and came back (the state outlives the page).
 */
export function useCellSaves(
  rowOf: (address: CellAddress) => FlatTranslationRow | undefined,
  onTouched: (address: CellAddress) => void,
) {
  const store = useCellStore()
  const states = useSaveStates(store.states)
  const { starts, expectedNow, take } = useCellStarts(store, rowOf)
  const saves = useKeySaves()
  const report = useCellReports(
    (address) => retryCell(context, address),
    (address) => discardCell(context, address),
  )
  const context: CellContext = { store, saves, states, report, onTouched }

  return {
    ...useCellView(store, states),
    begin: (address: CellAddress) =>
      starts.begin(idOfCell(address), expectedNow(address)),
    end: (address: CellAddress) => starts.end(idOfCell(address)),
    originOf: (address: CellAddress) => starts.of(idOfCell(address)),
    changedElsewhere: (address: CellAddress) =>
      changedElsewhere(store, starts, address, rowOf(address)),
    save: (address: CellAddress, draft: string) =>
      queueSave(context, address, draft, take(address)),
    keep: (address: CellAddress, draft: string, message: string) =>
      keepCell(context, starts, { ...address, draft, message }),
    hold: (holds: CellHold[]) =>
      holds.forEach((hold) => holdCell(context, hold)),
    retry: (address: CellAddress) => retryCell(context, address),
    discard: (address: CellAddress) => discardCell(context, address),
    markReviewed: (address: CellAddress) => markCellReviewed(context, address),
    confirmClearBase: saves.confirmClearBase,
  }
}
