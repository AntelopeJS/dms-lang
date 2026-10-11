import { useDmsState } from '#dms/frontend-module'
import type { FlatTranslationRow, TranslationValue } from '../../../types/lang'

export type CellState = 'idle' | 'saving' | 'saved' | 'error'

/** The text a save expects to replace (`null`: no text); `undefined` sends no check. */
type Expected = string | null | undefined

export interface CellFailure {
  /** The text that could not be saved: kept until saved or discarded. */
  draft: string
  message: string
  /** Someone changed the cell meanwhile: retrying overwrites their text. */
  isConflict: boolean
  /** What the next attempt expects: the value sent, or the other's text after a conflict. */
  expected: Expected
}

interface ConflictBody {
  current?: Record<string, TranslationValue>
  /** One sentence per problem of a refused message (`invalid_message`). */
  details?: string[]
}

interface FailedRequest {
  status?: number
  statusCode?: number
  data?: ConflictBody | string
}

const SAVED_FLASH_MS = 1800
const REVIEWED_ENDPOINT = '/api/lang/translations/key/reviewed'
const NOT_FOUND_STATUS = 404
const CONFLICT_CODE = 'conflict'
const CELL_SEPARATOR = '\u0000'

// Outside the component: a save still running when the page is left (another
// workspace, a remount) keeps its order and what it expects.
const chains = new Map<string, Promise<void>>()
/** What a save queued behind another, and not sent yet, expects. */
const waiting = new Map<string, Expected>()

/** A cell across workspaces: a text left unsaved in one is still there on return. */
function cellId(workspace: string, key: string, code: string): string {
  return [workspace, key, code].join(CELL_SEPARATOR)
}

/** What a cell stores: a text made of spaces only is no text (the key goes missing). */
function storedValue(value: string): string | null {
  return value.trim() === '' ? null : value
}

function layerValue(value: TranslationValue | null | undefined): string | null {
  return isLocaleValueMissing(value) ? null : stringValue(value)
}

/** The value a cell held in the workspace's own files when it was read. */
function ownValue(row: FlatTranslationRow, code: string): string | null {
  return layerValue(row.values[code])
}

function conflictValues(error: unknown): Record<string, TranslationValue> {
  const data = (error as FailedRequest | undefined)?.data
  return typeof data === 'object' ? (data?.current ?? {}) : {}
}

/** The server's sentences for a refused message, if it gave them. */
function problemDetails(error: unknown): string | undefined {
  const data = (error as FailedRequest | undefined)?.data
  const details = typeof data === 'object' ? data?.details : undefined
  return details?.length ? details.join(' ') : undefined
}

function isNotFound(error: unknown): boolean {
  const failure = error as FailedRequest | undefined
  return (failure?.status ?? failure?.statusCode) === NOT_FOUND_STATUS
}

/**
 * Saves matrix cells one by one, as soon as they are left (D1): the typed
 * text shows at once with a "Saving" state, saves of the same cell run in
 * order (a slow answer never overwrites a later text), and a failed text
 * stays on screen until it is saved or discarded, also after the page was
 * left for another workspace and came back (the state outlives the page).
 *
 * Each save expects the value the cell showed when its editing began (D11),
 * never the one read as it leaves: a change brought by the realtime refresh
 * while the cell was being typed in is a conflict (409), not a text silently
 * overwritten.
 */
export function useCellSaves(onTouched: (key: string) => void) {
  const { t } = useI18n()
  const toast = useToast()
  const { selectedWorkspace, upsertKey } = useI18nWorkspaces()
  const { flat, update, reload } = useWorkspaceFlat()
  const { reportFailure, errorMessage, isConflict, serverErrorCode } =
    useMutationToast()
  const { $authFetch } = useAuthFetch()

  const states = useDmsState<Record<string, CellState>>(
    'dms-lang-matrix-cell-states',
    () => ({}),
  )
  const pending = useDmsState<Record<string, string>>(
    'dms-lang-matrix-cell-pending',
    () => ({}),
  )
  const failures = useDmsState<Record<string, CellFailure>>(
    'dms-lang-matrix-cell-failures',
    () => ({}),
  )
  /** What each cell being edited showed when its editing began. */
  const origins = ref<Record<string, string | null>>({})

  const hasUnsaved = computed(
    () =>
      Object.keys(failures.value).length > 0 ||
      Object.keys(pending.value).length > 0,
  )

  function setState(id: string, state: CellState) {
    states.value = { ...states.value, [id]: state }
  }

  function setPending(id: string, value: string | undefined) {
    const { [id]: _previous, ...rest } = pending.value
    pending.value = value === undefined ? rest : { ...rest, [id]: value }
  }

  function setFailure(id: string, failure: CellFailure | undefined) {
    const { [id]: _previous, ...rest } = failures.value
    failures.value = failure ? { ...rest, [id]: failure } : rest
  }

  function setOrigin(id: string, origin: string | null | undefined) {
    const { [id]: _previous, ...rest } = origins.value
    origins.value = origin === undefined ? rest : { ...rest, [id]: origin }
  }

  function flashSaved(id: string) {
    setState(id, 'saved')
    setTimeout(() => {
      if (states.value[id] === 'saved') setState(id, 'idle')
    }, SAVED_FLASH_MS)
  }

  function rowOf(workspace: string, key: string) {
    if (workspace !== selectedWorkspace.value) return undefined
    return flat.value.rows.find((entry) => entry.key === key)
  }

  function patchRow(
    workspace: string,
    key: string,
    change: (row: FlatTranslationRow) => FlatTranslationRow,
  ) {
    update(workspace, (next) => {
      const index = next.rows.findIndex((entry) => entry.key === key)
      if (index >= 0) next.rows[index] = change(next.rows[index])
    })
  }

  function applySaved(
    workspace: string,
    key: string,
    code: string,
    value: string,
    row?: FlatTranslationRow,
  ) {
    patchRow(
      workspace,
      key,
      (current) =>
        row ?? {
          ...current,
          values: {
            ...current.values,
            [code]: storedValue(value) ?? undefined,
          },
        },
    )
  }

  function applyCurrent(workspace: string, key: string, error: unknown) {
    const current = conflictValues(error)
    patchRow(workspace, key, (row) => ({
      ...row,
      values: { ...row.values, ...current },
    }))
  }

  /** A 409 because the cell changed elsewhere (not a refused clearing). */
  function isValueConflict(error: unknown): boolean {
    if (!isConflict(error)) return false
    const code = serverErrorCode(error)
    return code
      ? code === CONFLICT_CODE
      : Object.keys(conflictValues(error)).length > 0
  }

  /** What a save sent now would replace: what the cell shows. */
  function expectedNow(workspace: string, key: string, code: string): Expected {
    const id = cellId(workspace, key, code)
    const failure = failures.value[id]
    if (failure) return failure.expected
    const typed = pending.value[id]
    if (typed !== undefined) return storedValue(typed)
    const row = rowOf(workspace, key)
    return row ? ownValue(row, code) : undefined
  }

  /** A conflict offers the cell's own two choices. */
  function reportConflict(
    workspace: string,
    key: string,
    code: string,
    message: string,
  ) {
    toast.add({
      title: t('dms_lang.matrix.conflict', { key, code }),
      description: message,
      color: 'error',
      icon: 'i-ph-warning-circle',
      actions: [
        {
          label: t('dms_lang.matrix.discard'),
          color: 'neutral',
          variant: 'outline',
          onClick: () => discardIn(workspace, key, code),
        },
        {
          label: t('dms_lang.matrix.overwrite'),
          onClick: () => retryIn(workspace, key, code),
        },
      ],
    })
  }

  function fail(
    workspace: string,
    key: string,
    code: string,
    value: string,
    expected: Expected,
    error: unknown,
  ) {
    const id = cellId(workspace, key, code)
    if (pending.value[id] !== value) return
    setPending(id, undefined)
    const conflict = isValueConflict(error)
    const current = conflictValues(error)
    const message = problemDetails(error) ?? errorMessage(error)
    setFailure(id, {
      draft: value,
      message,
      isConflict: conflict,
      // Overwriting replaces the text the cell now shows: the other's.
      expected:
        conflict && code in current ? layerValue(current[code]) : expected,
    })
    setState(id, 'error')
    if (conflict) applyCurrent(workspace, key, error)
    if (isNotFound(error)) void reload()
    if (conflict) {
      reportConflict(workspace, key, code, message)
      return
    }
    reportFailure(error, {
      title: t('dms_lang.matrix.save_failed', { key, code }),
      retry: () => retryIn(workspace, key, code),
    })
  }

  async function send(
    workspace: string,
    key: string,
    code: string,
    value: string,
    expected: Expected,
  ) {
    const id = cellId(workspace, key, code)
    // A later text of the cell supersedes this one and takes its check over.
    if (pending.value[id] !== value) return
    waiting.delete(id)
    try {
      const response = await upsertKey(
        workspace,
        key,
        { [code]: storedValue(value) },
        flat.value.defaultLocale,
        expected === undefined ? undefined : { [code]: expected },
      )
      applySaved(workspace, key, code, value, response?.row)
      if (pending.value[id] !== value) return
      setPending(id, undefined)
      flashSaved(id)
    } catch (error) {
      fail(workspace, key, code, value, expected, error)
    }
  }

  function queue(
    workspace: string,
    key: string,
    code: string,
    value: string,
    expected: Expected,
  ): Promise<void> {
    const id = cellId(workspace, key, code)
    // A save still waiting will be skipped: what it expected is still stored.
    const check = waiting.has(id) ? waiting.get(id) : expected
    waiting.set(id, check)
    if (workspace === selectedWorkspace.value) onTouched(key)
    setFailure(id, undefined)
    setPending(id, value)
    setState(id, 'saving')
    const next = (chains.get(id) ?? Promise.resolve()).then(() =>
      send(workspace, key, code, value, check),
    )
    chains.set(id, next)
    return next
  }

  /** Remembers what a cell shows as its editing begins, until it is saved or left. */
  function begin(key: string, code: string) {
    const id = idOf(key, code)
    if (id in origins.value) return
    setOrigin(id, expectedNow(selectedWorkspace.value, key, code))
  }

  /** The editing of a cell ended without a save (cancelled, unchanged, handed over). */
  function end(key: string, code: string, workspace = selectedWorkspace.value) {
    setOrigin(cellId(workspace, key, code), undefined)
  }

  /** What a cell being edited showed as its editing began. */
  function originOf(
    key: string,
    code: string,
    workspace = selectedWorkspace.value,
  ): Expected {
    return origins.value[cellId(workspace, key, code)]
  }

  /**
   * The other's text when the cell changed elsewhere since its editing began
   * (`''`: their change removed it); `undefined` while nothing changed.
   */
  function changedElsewhere(key: string, code: string): string | undefined {
    const id = idOf(key, code)
    const origin = origins.value[id]
    if (origin === undefined || pending.value[id] !== undefined)
      return undefined
    const row = rowOf(selectedWorkspace.value, key)
    if (!row) return undefined
    const current = ownValue(row, code)
    return current === origin ? undefined : (current ?? '')
  }

  /**
   * Queues a cell's text: it shows at once and saves after the cell's earlier
   * saves, expecting what the cell showed as its editing began.
   */
  function save(
    key: string,
    code: string,
    value: string,
    workspace = selectedWorkspace.value,
  ): Promise<void> {
    const id = cellId(workspace, key, code)
    const expected =
      id in origins.value
        ? origins.value[id]
        : expectedNow(workspace, key, code)
    setOrigin(id, undefined)
    return queue(workspace, key, code, value, expected)
  }

  /** Keeps a text unsaved, to be confirmed in the cell (a base text cleared on the way out). */
  function keep(
    key: string,
    code: string,
    value: string,
    message: string,
    workspace = selectedWorkspace.value,
  ) {
    const id = cellId(workspace, key, code)
    const expected = id in origins.value ? origins.value[id] : undefined
    setOrigin(id, undefined)
    setFailure(id, { draft: value, message, isConflict: false, expected })
    setState(id, 'error')
  }

  function retryIn(workspace: string, key: string, code: string) {
    const failure = failures.value[cellId(workspace, key, code)]
    if (failure) void save(key, code, failure.draft, workspace)
  }

  function discardIn(workspace: string, key: string, code: string) {
    const id = cellId(workspace, key, code)
    setFailure(id, undefined)
    setState(id, 'idle')
  }

  /** Drops a text that could not be saved: the cell shows its stored value again. */
  function discard(key: string, code: string) {
    discardIn(selectedWorkspace.value, key, code)
  }

  /** Keeps a translation as it is although the base text changed (out of "To review"). */
  async function markReviewed(key: string, code: string) {
    const workspace = selectedWorkspace.value
    try {
      const response = await $authFetch<{ row?: FlatTranslationRow }>(
        REVIEWED_ENDPOINT,
        { method: 'POST', body: { workspace, path: key, locales: [code] } },
      )
      const row = response?.row
      if (row) patchRow(workspace, key, () => row)
    } catch (error) {
      reportFailure(error, {
        title: t('dms_lang.matrix.save_failed', { key, code }),
      })
    }
  }

  /** The text a cell shows: the one being saved, else the stored one. */
  function shownValue(key: string, code: string, stored: string): string {
    return pending.value[idOf(key, code)] ?? stored
  }

  /** The id of a cell of the workspace on screen (or of the one given). */
  function idOf(
    key: string,
    code: string,
    workspace = selectedWorkspace.value,
  ): string {
    return cellId(workspace, key, code)
  }

  function stateOf(key: string, code: string): CellState {
    return states.value[idOf(key, code)] ?? 'idle'
  }

  function failureOf(key: string, code: string): CellFailure | undefined {
    return failures.value[idOf(key, code)]
  }

  function isPending(key: string, code: string): boolean {
    const id = idOf(key, code)
    return pending.value[id] !== undefined || failures.value[id] !== undefined
  }

  /** A text of the row that could not be saved: the row is not done. */
  function hasRowFailure(key: string): boolean {
    const prefix = cellId(selectedWorkspace.value, key, '')
    return Object.keys(failures.value).some((id) => id.startsWith(prefix))
  }

  return {
    hasUnsaved,
    begin,
    end,
    originOf,
    changedElsewhere,
    save,
    keep,
    discard,
    markReviewed,
    shownValue,
    stateOf,
    failureOf,
    isPending,
    hasRowFailure,
    idOf,
  }
}
