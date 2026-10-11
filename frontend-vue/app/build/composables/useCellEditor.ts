import type { Ref } from 'vue'
import { storedText } from '../../utils/keySaves'
import {
  checkMessage,
  escapeMessage,
  messageIssueText,
} from '../../utils/translations'
import { clearsBaseText } from './useKeySaves'
import type { CellAddress, useCellSaves } from './useCellSaves'
import type { useKeyPanel } from './useKeyPanel'

/** Where the editor goes once a cell is saved. */
export type CellMove = 'stay' | 'down' | 'next' | 'previous'

export interface CellRef {
  key: string
  code: string
}

export interface CellEditorOptions {
  saves: ReturnType<typeof useCellSaves>
  panel: ReturnType<typeof useKeyPanel>
  workspace: Ref<string>
  baseLocale: () => string
  locales: () => string[]
  canEdit: () => boolean
  /** The text a cell shows: the one being saved, else the stored one. */
  shownValue: (key: string, code: string) => string
  /** The cell a move goes to from a cell, if any. */
  targetOf: (cell: CellRef, move: CellMove) => CellRef | null
  onStart: (key: string) => void
  /** A move found no cell to go to: the focus goes back to the cell left. */
  onMoveEnd: (cell: CellRef) => void
}

interface EditingCell extends CellRef {
  /** The text the cell opens with. */
  draft: string
}

interface LiveDraft {
  text: string | undefined
}

interface OpenedCell {
  workspace: string
  isBase: boolean
}

interface EditorContext {
  options: CellEditorOptions
  editing: Ref<EditingCell | null>
  cursor: Ref<CellRef | null>
  live: LiveDraft
  isDirty: Ref<boolean>
  opened: OpenedCell
  blockingText: (draft: string) => string
  clearBaseKept: () => string
}

function addressOf(
  context: EditorContext,
  key: string,
  code: string,
  workspace = context.options.workspace.value,
): CellAddress {
  return { workspace, key, code }
}

function isEditing(context: EditorContext, key: string, code: string) {
  const cell = context.editing.value
  return cell?.key === key && cell.code === code
}

function trackDraft(
  context: EditorContext,
  key: string,
  code: string,
  text: string,
) {
  if (!isEditing(context, key, code)) return
  context.live.text = text
  context.isDirty.value = text !== context.options.shownValue(key, code)
}

function open(context: EditorContext, key: string, code: string, draft: string) {
  context.editing.value = { key, code, draft }
  trackDraft(context, key, code, draft)
}

function close(context: EditorContext) {
  context.editing.value = null
  context.live.text = undefined
  context.isDirty.value = false
}

function isClearingBase(
  context: EditorContext,
  key: string,
  code: string,
  draft: string,
): boolean {
  const { baseLocale, shownValue } = context.options
  return clearsBaseText(code, baseLocale(), draft, shownValue(key, code))
}

function keepInvalid(
  context: EditorContext,
  address: CellAddress,
  draft: string,
): boolean {
  const reason = context.blockingText(draft)
  if (reason) context.options.saves.keep(address, draft, reason)
  return reason !== ''
}

function moveFrom(
  context: EditorContext,
  key: string,
  code: string,
  move: CellMove,
) {
  const target = context.options.targetOf({ key, code }, move)
  if (target) nextTick(() => startEdit(context, target.key, target.code))
  else if (move !== 'stay') context.options.onMoveEnd({ key, code })
}

function startEdit(
  context: EditorContext,
  key: string,
  code: string,
  draft?: string,
) {
  const { options } = context
  if (!options.canEdit() || isEditing(context, key, code)) return
  commitEditing(context)
  const address = addressOf(context, key, code)
  const failure = options.saves.failureOf(address)
  options.saves.begin(address)
  context.opened.workspace = options.workspace.value
  context.opened.isBase = code === options.baseLocale()
  open(context, key, code, draft ?? failure?.draft ?? options.shownValue(key, code))
  context.cursor.value = { key, code }
  options.onStart(key)
}

function cancelEdit(context: EditorContext) {
  const cell = context.editing.value
  if (cell) context.options.saves.end(addressOf(context, cell.key, cell.code))
  close(context)
}

function commitEditing(context: EditorContext) {
  const cell = context.editing.value
  if (cell)
    void commitCell(context, cell, 'stay', context.live.text ?? cell.draft)
}

async function commitCell(
  context: EditorContext,
  cell: CellRef,
  move: CellMove,
  draft: string,
) {
  const { saves, workspace, shownValue } = context.options
  const { key, code } = cell
  const isOpen = isEditing(context, key, code)
  if (isOpen && context.opened.workspace !== workspace.value)
    return leaveEditing(context)
  if (isOpen) close(context)
  const address = addressOf(context, key, code)
  if (draft === shownValue(key, code)) {
    saves.end(address)
    return moveFrom(context, key, code, move)
  }
  if (
    isClearingBase(context, key, code, draft) &&
    !(await saves.confirmClearBase(key))
  )
    return open(context, key, code, draft)
  if (!keepInvalid(context, address, draft)) void saves.save(address, draft)
  moveFrom(context, key, code, move)
}

function leaveEditing(context: EditorContext) {
  const cell = context.editing.value
  if (!cell) return
  const { saves } = context.options
  const { workspace, isBase } = context.opened
  const address = addressOf(context, cell.key, cell.code, workspace)
  const draft = context.live.text ?? cell.draft
  close(context)
  const origin = saves.originOf(address)
  if (storedText(draft) === (origin ?? null)) return saves.end(address)
  if (keepInvalid(context, address, draft)) return
  if (isBase && storedText(draft) === null && origin)
    return saves.keep(address, draft, context.clearBaseKept())
  void saves.save(address, draft)
}

async function retryCell(context: EditorContext, key: string, code: string) {
  const { saves } = context.options
  const failure = saves.failureOf(addressOf(context, key, code))
  if (!failure) return
  if (context.blockingText(failure.draft)) return startEdit(context, key, code)
  if (
    isClearingBase(context, key, code, failure.draft) &&
    !(await saves.confirmClearBase(key))
  )
    return
  saves.retry(addressOf(context, key, code))
}

function escapeFailure(context: EditorContext, key: string, code: string) {
  const address = addressOf(context, key, code)
  const failure = context.options.saves.failureOf(address)
  if (!failure) return
  const escaped = escapeMessage(failure.draft)
  if (!keepInvalid(context, address, escaped))
    void context.options.saves.save(address, escaped)
}

async function openKey(
  context: EditorContext,
  key: string,
  focusLocale?: string,
) {
  const { saves, panel, locales } = context.options
  const failures = locales()
    .map((code) => [
      code,
      saves.failureOf(addressOf(context, key, code))?.draft,
    ])
    .filter((entry): entry is [string, string] => entry[1] !== undefined)
  const initialDrafts = failures.length
    ? Object.fromEntries(failures)
    : undefined
  if (!(await panel.open({ key, focusLocale, initialDrafts }))) return
  for (const [code, draft] of failures) {
    const address = addressOf(context, key, code)
    if (saves.failureOf(address)?.draft === draft) saves.discard(address)
  }
}

async function reopenEditor(
  context: EditorContext,
  key: string,
  code: string,
  draft: string,
) {
  close(context)
  await nextTick()
  if (!context.editing.value) open(context, key, code, draft)
}

async function openFromCell(
  context: EditorContext,
  key: string,
  code: string,
  draft: string,
) {
  const { saves, panel, shownValue } = context.options
  const address = addressOf(context, key, code)
  const failure = saves.failureOf(address)
  const text = draft !== shownValue(key, code) ? draft : failure?.draft
  const initialDrafts = text === undefined ? undefined : { [code]: text }
  const isShown = await panel.open({ key, focusLocale: code, initialDrafts })
  if (!isEditing(context, key, code)) return
  if (!isShown) return reopenEditor(context, key, code, draft)
  saves.end(address)
  if (failure) saves.discard(address)
  close(context)
}

function useEditorContext(options: CellEditorOptions): EditorContext {
  const { t } = useI18n()
  return {
    options,
    editing: ref<EditingCell | null>(null),
    cursor: ref<CellRef | null>(null),
    live: { text: undefined },
    isDirty: ref(false),
    opened: { workspace: '', isBase: false },
    blockingText: (draft) =>
      checkMessage('', draft)
        .filter((issue) => issue.severity === 'error')
        .map((issue) => messageIssueText(issue, t))
        .join(' '),
    clearBaseKept: () => t('dms_lang.matrix.clear_base_kept'),
  }
}

/**
 * The inline editing of the matrix: one cell open at a time, saved when it
 * is left (a text that would not compile stays "Not saved" in its cell, an
 * emptied base text asks first), handed over to the key panel on demand, and
 * saved in the workspace it was typed in when the page moves to another one.
 */
export function useCellEditor(options: CellEditorOptions) {
  const context = useEditorContext(options)

  return {
    cursor: readonly(context.cursor),
    hasOpenDraft: readonly(context.isDirty),
    isEditing: (key: string, code: string) => isEditing(context, key, code),
    initialDraftOf: (key: string, code: string) =>
      isEditing(context, key, code) ? (context.editing.value?.draft ?? '') : '',
    trackDraft: (key: string, code: string, text: string) =>
      trackDraft(context, key, code, text),
    startEdit: (key: string, code: string) => startEdit(context, key, code),
    cancelEdit: () => cancelEdit(context),
    commitEditing: () => commitEditing(context),
    commitCell: (key: string, code: string, move: CellMove, draft: string) =>
      commitCell(context, { key, code }, move, draft),
    leaveEditing: () => leaveEditing(context),
    retryCell: (key: string, code: string) => retryCell(context, key, code),
    escapeFailure: (key: string, code: string) =>
      escapeFailure(context, key, code),
    openKey: (key: string, focusLocale?: string) =>
      openKey(context, key, focusLocale),
    openFromCell: (key: string, code: string, draft: string) =>
      openFromCell(context, key, code, draft),
  }
}
