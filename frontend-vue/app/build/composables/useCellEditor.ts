import type { Ref } from 'vue'
import { saveIdOf, storedText, withEntry } from '../../utils/keySaves'
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
}

interface OpenedCell {
  workspace: string
  isBase: boolean
}

interface EditorContext {
  options: CellEditorOptions
  editing: Ref<CellRef | null>
  cursor: Ref<CellRef | null>
  drafts: Ref<Record<string, string>>
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

function idOf(context: EditorContext, key: string, code: string): string {
  return saveIdOf(context.options.workspace.value, key, code)
}

function isEditing(context: EditorContext, key: string, code: string) {
  const cell = context.editing.value
  return cell?.key === key && cell.code === code
}

function setDraft(
  context: EditorContext,
  key: string,
  code: string,
  value: string | undefined,
) {
  context.drafts.value = withEntry(
    context.drafts.value,
    idOf(context, key, code),
    value,
  )
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
}

function startEdit(context: EditorContext, key: string, code: string) {
  const { options } = context
  if (!options.canEdit() || isEditing(context, key, code)) return
  commitEditing(context)
  const address = addressOf(context, key, code)
  if (context.drafts.value[idOf(context, key, code)] === undefined) {
    const failure = options.saves.failureOf(address)
    setDraft(
      context,
      key,
      code,
      failure?.draft ?? options.shownValue(key, code),
    )
  }
  options.saves.begin(address)
  context.opened.workspace = options.workspace.value
  context.opened.isBase = code === options.baseLocale()
  context.editing.value = { key, code }
  context.cursor.value = { key, code }
  options.onStart(key)
}

function cancelEdit(context: EditorContext) {
  const cell = context.editing.value
  if (cell) {
    setDraft(context, cell.key, cell.code, undefined)
    context.options.saves.end(addressOf(context, cell.key, cell.code))
  }
  context.editing.value = null
}

function commitEditing(context: EditorContext) {
  const cell = context.editing.value
  if (cell) void commitCell(context, cell.key, cell.code, 'stay')
}

async function commitCell(
  context: EditorContext,
  key: string,
  code: string,
  move: CellMove,
) {
  const { saves, workspace, shownValue } = context.options
  if (
    isEditing(context, key, code) &&
    context.opened.workspace !== workspace.value
  )
    return leaveEditing(context)
  const address = addressOf(context, key, code)
  const draft = context.drafts.value[idOf(context, key, code)]
  setDraft(context, key, code, undefined)
  if (isEditing(context, key, code)) context.editing.value = null
  if (draft === undefined || draft === shownValue(key, code)) {
    saves.end(address)
    return moveFrom(context, key, code, move)
  }
  if (
    isClearingBase(context, key, code, draft) &&
    !(await saves.confirmClearBase(key))
  ) {
    setDraft(context, key, code, draft)
    context.editing.value = { key, code }
    return
  }
  if (!keepInvalid(context, address, draft)) void saves.save(address, draft)
  moveFrom(context, key, code, move)
}

function takeOpenDraft(context: EditorContext): string | undefined {
  const cell = context.editing.value
  if (!cell) return undefined
  const id = saveIdOf(context.opened.workspace, cell.key, cell.code)
  const draft = context.drafts.value[id]
  context.drafts.value = withEntry(context.drafts.value, id, undefined)
  return draft
}

function leaveEditing(context: EditorContext) {
  const cell = context.editing.value
  if (!cell) return
  const { saves } = context.options
  const address = addressOf(
    context,
    cell.key,
    cell.code,
    context.opened.workspace,
  )
  const draft = takeOpenDraft(context)
  context.editing.value = null
  const origin = saves.originOf(address)
  if (draft === undefined || storedText(draft) === (origin ?? null))
    return saves.end(address)
  if (keepInvalid(context, address, draft)) return
  if (context.opened.isBase && storedText(draft) === null && origin)
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

async function reopenEditor(context: EditorContext, key: string, code: string) {
  context.editing.value = null
  await nextTick()
  if (!context.editing.value) context.editing.value = { key, code }
}

async function openFromCell(context: EditorContext, key: string, code: string) {
  const { saves, panel, shownValue } = context.options
  const address = addressOf(context, key, code)
  const draft = context.drafts.value[idOf(context, key, code)]
  const failure = saves.failureOf(address)
  const typed = draft !== undefined && draft !== shownValue(key, code)
  const text = typed ? draft : failure?.draft
  const initialDrafts = text === undefined ? undefined : { [code]: text }
  const isShown = await panel.open({ key, focusLocale: code, initialDrafts })
  if (!isEditing(context, key, code)) return
  if (!isShown) return reopenEditor(context, key, code)
  setDraft(context, key, code, undefined)
  saves.end(address)
  if (failure) saves.discard(address)
  context.editing.value = null
}

function hasOpenDraft(context: EditorContext): boolean {
  const cell = context.editing.value
  if (!cell) return false
  const draft = context.drafts.value[idOf(context, cell.key, cell.code)]
  return (
    draft !== undefined &&
    draft !== context.options.shownValue(cell.key, cell.code)
  )
}

function useEditorContext(options: CellEditorOptions): EditorContext {
  const { t } = useI18n()
  return {
    options,
    editing: ref<CellRef | null>(null),
    cursor: ref<CellRef | null>(null),
    drafts: ref<Record<string, string>>({}),
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
  const { editing, cursor, drafts } = context

  return {
    editingCell: readonly(editing),
    cursor: readonly(cursor),
    hasOpenDraft: computed(() => hasOpenDraft(context)),
    isEditing: (key: string, code: string) => isEditing(context, key, code),
    draftOf: (key: string, code: string) =>
      drafts.value[idOf(context, key, code)] ?? '',
    setDraft: (key: string, code: string, value: string) =>
      setDraft(context, key, code, value),
    startEdit: (key: string, code: string) => startEdit(context, key, code),
    cancelEdit: () => cancelEdit(context),
    commitEditing: () => commitEditing(context),
    commitCell: (key: string, code: string, move: CellMove) =>
      commitCell(context, key, code, move),
    leaveEditing: () => leaveEditing(context),
    retryCell: (key: string, code: string) => retryCell(context, key, code),
    escapeFailure: (key: string, code: string) =>
      escapeFailure(context, key, code),
    openKey: (key: string, focusLocale?: string) =>
      openKey(context, key, focusLocale),
    openFromCell: (key: string, code: string) =>
      openFromCell(context, key, code),
  }
}
