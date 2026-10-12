import type { Ref } from 'vue'
import type { FlatTranslationRow, KeyRowResponse } from '../../types/lang'
import {
  keySaveFailure,
  type KeySaveFailure,
  type KeySaveFailureKind,
  type ApiMessageTranslate,
} from '../../utils/keySaveErrors'
import {
  queueTexts,
  saveIdOf,
  savedText,
  storedText,
  withEntry,
  type ExpectedText,
  type SaveState,
  type WriteLink,
} from '../../utils/keySaves'

/** The key a write goes to. */
export interface KeyTarget {
  workspace: string
  key: string
}

/** Texts of one key to save, each with the text its edit began on. */
export interface KeyWrite extends KeyTarget {
  /** The typed text of each language (spaces only: no text). */
  values: Record<string, string>
  /** What each text expects to replace, frozen when its edit began. */
  expected: Record<string, ExpectedText>
}

interface KeyWriteSaved {
  status: 'saved'
}

export interface KeyWriteFailed {
  status: 'failed'
  failure: KeySaveFailure
  /** The sentence to show: the server's problems with the text, else what failed. */
  message: string
  /** What the write expected: a later attempt expects the same. */
  expected: Record<string, ExpectedText>
  error: unknown
}

export type KeyWriteOutcome = KeyWriteSaved | KeyWriteFailed

interface KeySaveContext {
  updateKey: ReturnType<typeof useI18nWorkspaces>['updateKey']
  postReviewed: ReturnType<typeof useI18nWorkspaces>['markReviewed']
  translations: ReturnType<typeof useWorkspaceFlat>
  errorMessage: (error: unknown) => string
  translate: ApiMessageTranslate
}

/** The row a refused write leaves on screen, from what the refusal tells. */
type FailureChange = (
  row: FlatTranslationRow,
  failure: KeySaveFailure,
) => FlatTranslationRow

const SAVED_FLASH_MS = 1800
const SAVED: KeyWriteSaved = { status: 'saved' }

const links = new Map<string, Promise<WriteLink>>()

/** The texts a conflict says the server holds now. */
function applyCurrent(
  row: FlatTranslationRow,
  failure: KeySaveFailure,
): FlatTranslationRow {
  const current = Object.entries(failure.current).map(([code, value]) => [
    code,
    savedText(value) ?? undefined,
  ])
  return { ...row, values: { ...row.values, ...Object.fromEntries(current) } }
}

const FAILURE_CHANGES: Partial<Record<KeySaveFailureKind, FailureChange>> = {
  conflict: applyCurrent,
}

function textsOf(values: Record<string, string>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(values).map(([code, text]) => [code, storedText(text)]),
  )
}

function checksOf(
  expected: Record<string, ExpectedText>,
): Record<string, unknown> | undefined {
  const checks = Object.entries(expected).filter(
    ([, text]) => text !== undefined,
  )
  return checks.length ? Object.fromEntries(checks) : undefined
}

function applyResponse(
  context: KeySaveContext,
  target: KeyTarget,
  response: KeyRowResponse,
): KeyWriteOutcome {
  context.translations.applyRow(target.workspace, target.key, response)
  return SAVED
}

function failed(
  context: KeySaveContext,
  target: KeyTarget,
  expected: Record<string, ExpectedText>,
  error: unknown,
): KeyWriteFailed {
  const failure = keySaveFailure(error, context.translate)
  const change = FAILURE_CHANGES[failure.kind]
  const row = context.translations
    .flatOf(target.workspace)
    .rows.find((entry) => entry.key === target.key)
  if (change && row)
    context.translations.replaceRow(
      target.workspace,
      target.key,
      change(row, failure),
    )
  const message = failure.details.join(' ') || context.errorMessage(error)
  return { status: 'failed', failure, message, expected, error }
}

async function send(
  context: KeySaveContext,
  request: KeyWrite,
  expected: Record<string, ExpectedText>,
): Promise<KeyWriteOutcome> {
  try {
    const response = await context.updateKey(
      request.workspace,
      request.key,
      textsOf(request.values),
      checksOf(expected),
    )
    return applyResponse(context, request, response)
  } catch (error) {
    return failed(context, request, expected, error)
  }
}

function queueWrite(
  context: KeySaveContext,
  request: KeyWrite,
): Promise<KeyWriteOutcome> {
  const codes = Object.keys(request.values)
  const texts = codes.map((code) => ({
    id: saveIdOf(request.workspace, request.key, code),
    text: request.values[code],
    expected: request.expected[code],
  }))
  const sendCarried = (expected: ExpectedText[]) =>
    send(
      context,
      request,
      Object.fromEntries(codes.map((code, index) => [code, expected[index]])),
    )
  return queueTexts(
    links,
    texts,
    sendCarried,
    (outcome) => outcome.status === 'saved',
  )
}

async function markReviewed(
  context: KeySaveContext,
  target: KeyTarget,
  code: string,
): Promise<KeyWriteOutcome> {
  try {
    const response = await context.postReviewed(target.workspace, target.key, [
      code,
    ])
    return applyResponse(context, target, response)
  } catch (error) {
    return failed(context, target, {}, error)
  }
}

/** Whether a text typed in the base language clears a base text that was there. */
export function clearsBaseText(
  code: string,
  base: string,
  draft: string,
  stored: string,
): boolean {
  return code === base && storedText(draft) === null && stored !== ''
}

/**
 * The one way the module saves the texts of a key (matrix cells, key panel,
 * translation queue): the writes of a text run in order, each expecting the
 * text its edit began on (a change made elsewhere meanwhile is a conflict,
 * never overwritten), the translations every page shows follow what the
 * server stored, and a refused write says why (conflict, deleted, invalid).
 */
export function useKeySaves() {
  const { updateKey, markReviewed: postReviewed } = useI18nWorkspaces()
  const translations = useWorkspaceFlat()
  const { errorMessage } = useMutationToast()
  const { confirm } = useConfirm()
  const { t } = useI18n()
  const context: KeySaveContext = {
    updateKey,
    postReviewed,
    translations,
    errorMessage,
    translate: (key, params) => t(key, params),
  }

  return {
    /** Queues texts of a key behind the earlier writes of the same texts. */
    write: (request: KeyWrite) => queueWrite(context, request),
    /** Keeps a translation as it is although the base text changed. */
    markReviewed: (target: KeyTarget, code: string) =>
      markReviewed(context, target, code),
    /** Takes a key deleted elsewhere off the translations every page shows. */
    dropRow: (target: KeyTarget) =>
      translations.replaceRow(target.workspace, target.key, undefined),
    /** Asks before a base text is emptied: the key would go missing everywhere. */
    confirmClearBase: (key: string) =>
      confirm({
        title: t('dms_lang.matrix.clear_base_title', { key }),
        description: t('dms_lang.matrix.clear_base_description'),
        color: 'warning',
        confirmLabel: t('dms_lang.matrix.clear_base_confirm'),
      }),
  }
}

/** The save state of each text of a set, a save flashing "Saved" for a moment. */
export function useSaveStates(states: Ref<Record<string, SaveState>>) {
  function stateOf(id: string): SaveState {
    return states.value[id] ?? 'idle'
  }

  function setState(id: string, state: SaveState) {
    states.value = withEntry(states.value, id, state)
  }

  function flashSaved(id: string) {
    setState(id, 'saved')
    setTimeout(() => {
      if (states.value[id] === 'saved') setState(id, 'idle')
    }, SAVED_FLASH_MS)
  }

  return { stateOf, setState, flashSaved }
}

/** The text each edit began on, kept until its text is saved or the edit ends. */
export function useEditStarts() {
  const starts = ref<Record<string, ExpectedText>>({})

  return {
    has: (id: string) => id in starts.value,
    of: (id: string): ExpectedText => starts.value[id],
    /** Remembers what a text shows as its edit begins (once per edit). */
    begin(id: string, text: ExpectedText) {
      if (!(id in starts.value))
        starts.value = withEntry(starts.value, id, text)
    },
    set(id: string, text: ExpectedText) {
      starts.value = { ...starts.value, [id]: text }
    },
    end(id: string) {
      starts.value = withEntry(starts.value, id, undefined)
    },
    clear() {
      starts.value = {}
    },
  }
}
