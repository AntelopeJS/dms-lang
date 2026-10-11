<script setup lang="ts">
import { useWorkspaceFlatSync } from '../composables/translation/useWorkspaceFlat'
import UButton from '@nuxt/ui/components/Button.vue'
import UDropdownMenu from '@nuxt/ui/components/DropdownMenu.vue'
import { useDmsRouter } from '#dms/frontend-module'
import type { FlatTranslationRow, LanguageCoverage } from '../types/lang'
import {
  checkMessage,
  coverageTone,
  escapeMessage,
  languageCoverage,
  messageIssueText,
  stringValue,
} from '../utils/translations'
import LocaleTile from '../build/components/LocaleTile.vue'
import PlaceholderText from '../build/components/PlaceholderText.vue'
import MatrixCell, {
  type CellMove,
} from '../build/components/matrix/MatrixCell.vue'
import MatrixColumns from '../build/components/matrix/MatrixColumns.vue'
import MatrixGroupHeader from '../build/components/matrix/MatrixGroupHeader.vue'
import MatrixKeyCell from '../build/components/matrix/MatrixKeyCell.vue'
import MatrixToolbar from '../build/components/matrix/MatrixToolbar.vue'
import { exportFileName, translationsCsv } from '../utils/matrixExport'
import {
  useCellSaves,
  type CellAddress,
} from '../build/composables/useCellSaves'
import { clearsBaseText } from '../build/composables/useKeySaves'
import { saveIdOf, storedText } from '../utils/keySaves'
import { useKeyPanel } from '../build/composables/useKeyPanel'
import { useMatrixRows } from '../build/composables/useMatrixRows'
import { useMatrixView } from '../build/composables/useMatrixView'
import { useMatrixFilters } from '../build/composables/useMatrixFilters'

interface CellRef {
  key: string
  code: string
}

type JumpStep = 1 | -1

const COMPACT_WIDTH = 768
/** A dialog, a drawer or the key panel is open: N belongs to it. */
const OPEN_OVERLAY = '[role="dialog"][data-state="open"], [role="alertdialog"]'
const SCROLL_MARGIN = '400px'
const ARROW_STEPS: Record<string, [number, number]> = {
  ArrowUp: [-1, 0],
  ArrowDown: [1, 0],
  ArrowLeft: [0, -1],
  ArrowRight: [0, 1],
}
const BAR_CLASSES: Record<'success' | 'warning' | 'error', string> = {
  success: 'bg-success',
  warning: 'bg-warning',
  error: 'bg-error',
}

const { t } = useI18n()
const { formatCount } = useLangFormat()
const { selectedWorkspace, editable: serverEditable } = useI18nWorkspaces()
const { flat, isLoaded, isLoading, hasError, reload } = useWorkspaceFlat()
useWorkspaceFlatSync()
const {
  current,
  isUnknown,
  isResolved,
  isDefault,
  isModules,
  canEditValues,
  canManage,
  canManageKeys,
} = useWorkspaceContext()
const { nameAmong, fullName } = useLocaleNames()
const { addKey } = useKeyActions()
const { addLanguage } = useLanguageActions()
const { downloadFile } = useWorkspaceActions()
const { route, pageAction, clearPageAction, selectWorkspace } =
  useWorkspaceRoute()
const router = useDmsRouter()
const toast = useToast()
const links = useLangLinks()
const { filters, order, saveOrder, sanitize, resetFilters } = useMatrixView()

const pinned = ref<Set<string>>(new Set())
const editingCell = ref<CellRef | null>(null)
const cursor = ref<CellRef | null>(null)
const drafts = ref<Record<string, string>>({})
// The cell being edited, as it was opened: its workspace may be left (the
// page remounts) while it is open.
let editingWorkspace = ''
let isEditingBase = false
const width = ref(Number.POSITIVE_INFINITY)
const root = useTemplateRef<{ $el?: HTMLElement }>('root')
const scroller = useTemplateRef<HTMLElement>('scroller')
const sentinel = useTemplateRef<HTMLElement>('sentinel')

const saves = useCellSaves(
  (address) => rowOf(address),
  (address) => {
    if (address.workspace === selectedWorkspace.value) pin(address.key)
  },
)
const isCompact = computed(() => width.value < COMPACT_WIDTH)

const languages = computed<LanguageCoverage[]>(() =>
  languageCoverage(flat.value, (code) => nameAmong(code, flat.value.locales)),
)
const languageByCode = computed(
  () => new Map(languages.value.map((entry) => [entry.code, entry])),
)
const targetLanguages = computed(() =>
  languages.value
    .filter((entry) => !entry.isBase)
    .map((entry) => ({ code: entry.code, name: fullName(entry.code) })),
)
/** The language being translated: the chosen one, or the first shown on a phone. */
const todoLanguage = computed(() => {
  const chosen = filters.value.missingIn
  if (chosen && flat.value.locales.includes(chosen)) return chosen
  if (!isCompact.value) return ''
  const base = flat.value.defaultLocale
  return order.value.find((code) => code !== base) ?? ''
})
const columnCodes = computed(() => {
  if (!todoLanguage.value) return order.value
  const base = flat.value.defaultLocale
  return [base, todoLanguage.value].filter((code) =>
    flat.value.locales.includes(code),
  )
})
const columns = computed(() =>
  columnCodes.value
    .map((code) => languageByCode.value.get(code))
    .filter((entry): entry is LanguageCoverage => Boolean(entry)),
)
const columnSiblings = computed(() => columns.value.map((entry) => entry.code))
const compactColumn = computed(() => columns.value.at(-1))
/**
 * The table's width when the columns sit at their set widths (key column
 * included). Firefox sizes a full-width `min-w-max` table to millions of pixels.
 */
const tableMinWidth = computed(
  () => `${16 + columns.value.length * (todoLanguage.value ? 28 : 15)}rem`,
)

const { rows, groups, counts, targets, namespaces, isRowDone } =
  useMatrixFilters(flat, filters, columnCodes, pinned)
/** A row with a text not saved (a conflict, an error) is not done. */
function isRowFinished(row: FlatTranslationRow): boolean {
  return isRowDone(row) && !saves.hasRowFailure(selectedWorkspace.value, row.key)
}
const doneCount = computed(() => rows.value.filter(isRowFinished).length)
const rowCount = computed(() => rows.value.length)
const view = useMatrixRows(groups, rowCount)
const rowIndex = computed(
  () => new Map(view.renderedRows.value.map((row, index) => [row.key, index])),
)

const rowsByKey = computed(
  () => new Map(flat.value.rows.map((row) => [row.key, row])),
)

const panel = useKeyPanel({
  keys: () => rows.value.map((row) => row.key),
  editable: () => canEditValues.value,
  manageKeys: () => canManageKeys.value,
  canOverride: () => isModules.value && serverEditable.value,
  isKnown: (key) => rowsByKey.value.has(key),
  onUnknown: (key) => void dropUnknownKey(key),
  onOverride: (key) => {
    const row = rowsByKey.value.get(key)
    if (row) void overrideKey(row)
  },
})

const countedLabel = computed(() =>
  targets.value.length === 1
    ? (languageByCode.value.get(targets.value[0])?.name ?? targets.value[0])
    : t(
        'dms_lang.matrix.languages_counted',
        { count: targets.value.length },
        targets.value.length,
      ),
)

const hasOpenDraft = computed(() => {
  const cell = editingCell.value
  if (!cell) return false
  const draft = drafts.value[idOf(cell.key, cell.code)]
  return draft !== undefined && draft !== shownValue(cell.key, cell.code)
})

useUnsavedChanges({ dirty: () => saves.hasUnsaved.value || hasOpenDraft.value })

function at(
  key: string,
  code: string,
  workspace = selectedWorkspace.value,
): CellAddress {
  return { workspace, key, code }
}

function idOf(key: string, code: string, workspace = selectedWorkspace.value) {
  return saveIdOf(workspace, key, code)
}

function rowOf(address: CellAddress): FlatTranslationRow | undefined {
  if (address.workspace !== selectedWorkspace.value) return undefined
  return rowsByKey.value.get(address.key)
}

function pin(key: string) {
  if (pinned.value.has(key)) return
  pinned.value = new Set([...pinned.value, key])
}

function rowValue(row: FlatTranslationRow | undefined, code: string): string {
  return row
    ? saves.shownValue(at(row.key, code), stringValue(row.values[code]))
    : ''
}

function shownValue(key: string, code: string): string {
  return rowValue(rowsByKey.value.get(key), code)
}

function isEditingCell(key: string, code: string): boolean {
  return editingCell.value?.key === key && editingCell.value.code === code
}

function setDraft(key: string, code: string, value: string | undefined) {
  const id = idOf(key, code)
  const { [id]: _previous, ...rest } = drafts.value
  drafts.value = value === undefined ? rest : { ...rest, [id]: value }
}

function startEdit(key: string, code: string) {
  if (!canEditValues.value || isEditingCell(key, code)) return
  commitEditing()
  const id = idOf(key, code)
  if (drafts.value[id] === undefined)
    setDraft(
      key,
      code,
      saves.failureOf(at(key, code))?.draft ?? shownValue(key, code),
    )
  saves.begin(at(key, code))
  editingWorkspace = selectedWorkspace.value
  isEditingBase = code === flat.value.defaultLocale
  editingCell.value = { key, code }
  cursor.value = { key, code }
  pin(key)
}

function cancelEdit() {
  const cell = editingCell.value
  if (cell) {
    setDraft(cell.key, cell.code, undefined)
    saves.end(at(cell.key, cell.code))
  }
  editingCell.value = null
}

function commitEditing() {
  const cell = editingCell.value
  if (cell) void commitCell(cell.key, cell.code, 'stay')
}

function isClearingBase(key: string, code: string, draft: string): boolean {
  return clearsBaseText(
    code,
    flat.value.defaultLocale,
    draft,
    shownValue(key, code),
  )
}

async function commitCell(key: string, code: string, move: CellMove) {
  if (isEditingCell(key, code) && editingWorkspace !== selectedWorkspace.value)
    return leaveEditing()
  const draft = drafts.value[idOf(key, code)]
  setDraft(key, code, undefined)
  if (isEditingCell(key, code)) editingCell.value = null
  const hasChanged = draft !== undefined && draft !== shownValue(key, code)
  if (hasChanged && isClearingBase(key, code, draft)) {
    if (!(await saves.confirmClearBase(key))) {
      setDraft(key, code, draft)
      editingCell.value = { key, code }
      return
    }
  }
  if (hasChanged && keepInvalid(key, code, draft))
    return moveFrom(key, code, move)
  if (hasChanged) void saves.save(at(key, code), draft)
  else saves.end(at(key, code))
  moveFrom(key, code, move)
}

/** What makes a text impossible to compile (vue-i18n syntax), as sentences; '' when it compiles. */
function blockingText(draft: string): string {
  return checkMessage('', draft)
    .filter((issue) => issue.severity === 'error')
    .map((issue) => messageIssueText(issue, t))
    .join(' ')
}

/**
 * A text that would not compile is not sent, as in the panel: the cell keeps
 * it "Not saved" with the reason, to fix, escape or discard.
 */
function keepInvalid(
  key: string,
  code: string,
  draft: string,
  workspace = selectedWorkspace.value,
): boolean {
  const reason = blockingText(draft)
  if (reason) saves.keep(at(key, code, workspace), draft, reason)
  return reason !== ''
}

/**
 * The workspace is left with a cell open: its text is saved in the workspace
 * it was typed in (a cleared base text waits there for a confirmation),
 * never lost nor written to the new one.
 */
function leaveEditing() {
  const cell = editingCell.value
  const workspace = editingWorkspace
  if (!cell) return
  editingCell.value = null
  const id = idOf(cell.key, cell.code, workspace)
  const { [id]: draft, ...rest } = drafts.value
  drafts.value = rest
  const origin = saves.originOf(at(cell.key, cell.code, workspace))
  if (draft === undefined || storedText(draft) === (origin ?? null)) {
    saves.end(at(cell.key, cell.code, workspace))
    return
  }
  if (keepInvalid(cell.key, cell.code, draft, workspace)) return
  if (isEditingBase && storedText(draft) === null && origin) {
    saves.keep(
      at(cell.key, cell.code, workspace),
      draft,
      t('dms_lang.matrix.clear_base_kept'),
    )
    return
  }
  void saves.save(at(cell.key, cell.code, workspace), draft)
}

async function retryCell(key: string, code: string) {
  const failure = saves.failureOf(at(key, code))
  if (!failure) return
  // A text that does not compile goes back to the editor to be fixed.
  if (blockingText(failure.draft)) return startEdit(key, code)
  if (
    isClearingBase(key, code, failure.draft) &&
    !(await saves.confirmClearBase(key))
  )
    return
  void saves.save(at(key, code), failure.draft)
}

/** Writes the bare `@` and lone braces of a text kept unsaved as literals, then saves it. */
function escapeFailure(key: string, code: string) {
  const failure = saves.failureOf(at(key, code))
  if (!failure) return
  const escaped = escapeMessage(failure.draft)
  if (!keepInvalid(key, code, escaped)) void saves.save(at(key, code), escaped)
}

/** A link named a key the workspace does not hold (renamed, deleted). */
async function dropUnknownKey(key: string) {
  toast.add({
    title: t('dms_lang.matrix.key_not_found', { key }),
    description: t('dms_lang.matrix.key_not_found_description'),
    color: 'warning',
    icon: 'i-ph-magnifying-glass',
  })
  if (route.query.key !== key) return
  await router.replace(
    linkWithQuery(route.path, { ...route.query, key: undefined }),
  )
}

/** The columns Tab and Enter walk through: the base only when one edits it. */
function navigableCodes(code: string): string[] {
  const base = flat.value.defaultLocale
  const codes = columnCodes.value
  if (code === base || codes.length === 1) return codes
  return codes.filter((entry) => entry !== base)
}

function neighbourRow(key: string, step: JumpStep): string | undefined {
  const shown = view.renderedRows.value
  const index = shown.findIndex((row) => row.key === key)
  if (step > 0 && index === shown.length - 1 && view.hasMore.value)
    view.showMore()
  return view.renderedRows.value[index + step]?.key
}

function sideCell(key: string, code: string, step: JumpStep): CellRef | null {
  const codes = navigableCodes(code)
  const next = codes[codes.indexOf(code) + step]
  if (next) return { key, code: next }
  const row = neighbourRow(key, step)
  if (!row) return null
  return { key: row, code: step > 0 ? codes[0] : codes[codes.length - 1] }
}

const MOVES: Record<CellMove, (key: string, code: string) => CellRef | null> = {
  stay: () => null,
  down: (key, code) => {
    const row = neighbourRow(key, 1)
    return row ? { key: row, code } : null
  },
  next: (key, code) => sideCell(key, code, 1),
  previous: (key, code) => sideCell(key, code, -1),
}

function moveFrom(key: string, code: string, move: CellMove) {
  const target = MOVES[move](key, code)
  if (target) nextTick(() => startEdit(target.key, target.code))
}

/** Every empty cell of the counted languages, in the order they show. */
function missingCells(): CellRef[] {
  const codes = columnCodes.value.filter((code) => targets.value.includes(code))
  return groups.value.flatMap((group) =>
    group.rows.flatMap((row) =>
      codes
        .filter(
          (code) =>
            isRowValueMissing(row, code) && !saves.isPending(at(row.key, code)),
        )
        .map((code) => ({ key: row.key, code })),
    ),
  )
}

function cellIndex(cell: CellRef, keys: string[], codes: string[]): number {
  return keys.indexOf(cell.key) * codes.length + codes.indexOf(cell.code)
}

function pickMissing(cells: CellRef[], step: JumpStep): CellRef | undefined {
  const from = cursor.value
  if (!from) return step > 0 ? cells[0] : cells.at(-1)
  const keys = groups.value.flatMap((group) => group.rows.map((row) => row.key))
  const codes = columnCodes.value
  const origin = cellIndex(from, keys, codes)
  const ordered = step > 0 ? cells : [...cells].reverse()
  const found = ordered.find(
    (cell) => step * (cellIndex(cell, keys, codes) - origin) > 0,
  )
  return found ?? ordered[0]
}

/** N / Shift+N: the next or previous empty cell, its namespace opened and scrolled to. */
function jumpToMissing(step: JumpStep) {
  const target = pickMissing(missingCells(), step)
  if (!target) return
  view.reveal(target.key)
  startEdit(target.key, target.code)
  nextTick(() =>
    root.value?.$el
      ?.querySelector('[data-editing]')
      ?.scrollIntoView({ block: 'center', inline: 'nearest' }),
  )
}

function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    target.closest('input, textarea, select, [contenteditable]') !== null
  )
}

function onKeydown(event: KeyboardEvent) {
  if (!canEditValues.value || event.key.toLowerCase() !== 'n') return
  if (event.ctrlKey || event.metaKey || event.altKey) return
  if (isTyping(event.target) || document.querySelector(OPEN_OVERLAY)) return
  event.preventDefault()
  jumpToMissing(event.shiftKey ? -1 : 1)
}

/** Arrow keys move between cells, as in a spreadsheet. */
function onGridKeydown(event: KeyboardEvent) {
  const step = ARROW_STEPS[event.key]
  const cell = (event.target as HTMLElement).closest<HTMLElement>(
    'td[data-row]',
  )
  if (!step || !cell || isTyping(event.target)) return
  const row = Number(cell.dataset.row) + step[0]
  const column = Number(cell.dataset.col) + step[1]
  const target = root.value?.$el?.querySelector<HTMLElement>(
    `td[data-row="${row}"][data-col="${column}"] button`,
  )
  if (!target) return
  event.preventDefault()
  target.focus()
}

/**
 * The panel, opened on a key with whatever the matrix had not saved for it.
 * The texts leave their cells only once the panel took the key: an open panel
 * with a field waiting for a choice stays on its own key and says why.
 */
async function openKey(key: string, focusLocale?: string) {
  const initialDrafts: Record<string, string> = {}
  for (const code of flat.value.locales) {
    const failure = saves.failureOf(at(key, code))
    if (failure) initialDrafts[code] = failure.draft
  }
  const handed = Object.keys(initialDrafts)
  const isShown = await panel.open({
    key,
    focusLocale,
    initialDrafts: handed.length ? initialDrafts : undefined,
  })
  if (!isShown) return
  for (const code of handed)
    if (saves.failureOf(at(key, code))?.draft === initialDrafts[code])
      saves.discard(at(key, code))
}

/** From a cell being edited: the panel takes over the text typed so far, once it shows the key. */
async function openFromCell(key: string, code: string) {
  const draft = drafts.value[idOf(key, code)]
  const typed = draft !== undefined && draft !== shownValue(key, code)
  const failure = saves.failureOf(at(key, code))
  const text = typed ? draft : failure?.draft
  const initialDrafts = text === undefined ? undefined : { [code]: text }
  const isShown = await panel.open({ key, focusLocale: code, initialDrafts })
  if (!isEditingCell(key, code)) return
  if (!isShown) return reopenEditor(key, code)
  setDraft(key, code, undefined)
  saves.end(at(key, code))
  // The panel now holds the text: an older failure of this cell would only resend a stale value.
  if (failure) saves.discard(at(key, code))
  editingCell.value = null
}

/** The panel kept its key: the editor opens again on the text, saved as usual when left. */
async function reopenEditor(key: string, code: string) {
  editingCell.value = null
  await nextTick()
  if (!editingCell.value) editingCell.value = { key, code }
}

async function overrideKey(row: FlatTranslationRow) {
  panel.seedOverride(row)
  await selectWorkspace(DEFAULT_WORKSPACE, { query: { key: row.key } })
}

function cellProps(row: FlatTranslationRow, column: LanguageCoverage) {
  const { key } = row
  const { code } = column
  return {
    value: rowValue(row, code),
    baseValue: rowValue(row, flat.value.defaultLocale),
    inherited:
      isDefault.value && row.inherited
        ? stringValue(row.inherited[code]) || undefined
        : undefined,
    override: isModules.value ? row.overrides?.[code] : undefined,
    isBase: column.isBase,
    editable: canEditValues.value,
    isEditing: isEditingCell(key, code),
    state: saves.stateOf(at(key, code)),
    failure: saves.failureOf(at(key, code)),
    rowKey: key,
    languageName: column.name,
    isOutdated: row.outdated?.includes(code) ?? false,
    draft: drafts.value[idOf(key, code)] ?? '',
    changedElsewhere: isEditingCell(key, code)
      ? saves.changedElsewhere(at(key, code))
      : undefined,
  }
}

function cellEvents(row: FlatTranslationRow, column: LanguageCoverage) {
  const { key } = row
  const { code } = column
  return {
    edit: () => startEdit(key, code),
    commit: (move: CellMove) => commitCell(key, code, move),
    cancel: cancelEdit,
    retry: () => retryCell(key, code),
    discard: () => saves.discard(at(key, code)),
    escape: () => escapeFailure(key, code),
    openPanel: () => openFromCell(key, code),
    review: () => void saves.markReviewed(at(key, code)),
    'update:draft': (value: string) => setDraft(key, code, value),
  }
}

function hideDone() {
  pinned.value = new Set()
}

function exportCsv(isView: boolean) {
  const base = flat.value.defaultLocale
  // Everything follows the chosen column order too, hidden languages last.
  const ordered = isView
    ? columnCodes.value
    : [...new Set([...order.value, ...flat.value.locales])].filter((code) =>
        flat.value.locales.includes(code),
      )
  const locales = [base, ...ordered.filter((code) => code !== base)]
  const content = translationsCsv(
    isView ? rows.value : flat.value.rows,
    locales,
  )
  downloadFile(
    exportFileName(selectedWorkspace.value, isView ? locales : undefined),
    content,
    'text/csv;charset=utf-8',
  )
}

function keysLabel(count: number): string {
  return t('dms_lang.matrix.group_keys', { count: formatCount(count) }, count)
}

function languagesLabel(count: number): string {
  return t('dms_lang.matrix.languages_counted', { count }, count)
}

usePageHeaderActions(() => [
  h(
    UDropdownMenu,
    {
      items: [
        {
          label: t('dms_lang.matrix.export_view', {
            keys: keysLabel(rows.value.length),
            languages: languagesLabel(columnCodes.value.length),
          }),
          icon: 'i-ph-funnel',
          onSelect: () => exportCsv(true),
        },
        {
          label: t('dms_lang.matrix.export_all', {
            keys: keysLabel(flat.value.rows.length),
            languages: languagesLabel(flat.value.locales.length),
          }),
          icon: 'i-ph-table',
          onSelect: () => exportCsv(false),
        },
      ],
      content: { align: 'end' },
    },
    () =>
      h(UButton, {
        label: t('dms_lang.matrix.export'),
        icon: 'i-ph-download-simple',
        trailingIcon: 'i-ph-caret-down',
        color: 'neutral',
        variant: 'outline',
        disabled: !isLoaded.value,
      }),
  ),
  canManageKeys.value
    ? h(UButton, {
        label: t('dms_lang.key_add.title'),
        icon: 'i-ph-plus',
        onClick: () => addKey(),
      })
    : null,
])

watch(
  () => [filters.value, selectedWorkspace.value],
  () => {
    commitEditing()
    pinned.value = new Set()
    view.reset()
  },
  { deep: true },
)

watch([namespaces, () => flat.value.locales.join(',')], () =>
  sanitize(namespaces.value),
)

// The rights come with the workspace list: the dialog waits for it, and for
// the translations, before the action is taken off the URL.
watch(
  [pageAction, isResolved, isUnknown],
  async ([action, resolved, unknown]) => {
    if (action !== PAGE_ACTIONS.addKey || (!resolved && !unknown)) return
    await clearPageAction()
    if (resolved && canManageKeys.value) await addKey()
  },
  { immediate: true },
)

let resizeObserver: ResizeObserver | undefined
let scrollObserver: IntersectionObserver | undefined

function observeEnd(element: HTMLElement | null) {
  scrollObserver?.disconnect()
  if (!element) return
  scrollObserver = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) view.showMore()
    },
    {
      root: isCompact.value ? null : scroller.value,
      rootMargin: SCROLL_MARGIN,
    },
  )
  scrollObserver.observe(element)
}

// A new observer reports at once: rows keep coming while the end stays in view.
watch([sentinel, isCompact, () => view.renderedRows.value.length], () =>
  nextTick(() => observeEnd(sentinel.value)),
)

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  const element = root.value?.$el
  if (!element) return
  resizeObserver = new ResizeObserver(([entry]) => {
    width.value = entry.contentRect.width
  })
  resizeObserver.observe(element)
})

const matrixPath = route.path

onBeforeUnmount(() => {
  // Another workspace remounts the page with a cell still open: its text is
  // saved. Leaving the page asked first (useUnsavedChanges).
  if (route.path === matrixPath) leaveEditing()
  window.removeEventListener('keydown', onKeydown)
  resizeObserver?.disconnect()
  scrollObserver?.disconnect()
})
</script>

<template>
  <DmsCard v-if="!isUnknown" ref="root" :padded="false" class="overflow-hidden">
    <MatrixToolbar
      v-model:filters="filters"
      :counts="counts"
      :languages="targetLanguages"
      :namespaces="namespaces"
      :counted-languages="targets.length"
      :shown-language="todoLanguage"
      :is-compact="isCompact"
    >
      <MatrixColumns
        v-if="!todoLanguage && !isCompact"
        :order="order"
        :languages="languages"
        :can-manage="canManage"
        :settings-link="links.workspaceSettings()"
        @update:order="saveOrder"
        @add="addLanguage()"
      />
    </MatrixToolbar>

    <div v-if="isModules" class="p-3">
      <DmsBanner
        tone="warning"
        size="sm"
        icon="i-ph-lock-simple"
        :title="$t('dms_lang.modules_notice.title')"
        :description="$t('dms_lang.modules_notice.override')"
      />
    </div>

    <div
      v-if="doneCount"
      class="border-default bg-success/5 flex flex-wrap items-center gap-2 border-b px-4 py-2 text-sm"
      role="status"
    >
      <UIcon name="i-ph-check-circle" class="text-success size-4" />
      <span class="text-default">
        {{
          $t(
            'dms_lang.matrix.done_banner',
            { count: formatCount(doneCount) },
            doneCount,
          )
        }}
      </span>
      <UButton
        size="xs"
        color="neutral"
        variant="outline"
        class="ml-auto"
        :label="$t('dms_lang.matrix.hide_done')"
        @click="hideDone"
      />
    </div>

    <DmsEmptyState
      v-if="hasError && !isLoaded"
      variant="error"
      size="lg"
      hatched
      :title="$t('dms_lang.errors.load_title', { name: current?.id ?? '' })"
      :description="$t('dms_lang.errors.load_description')"
      :actions="[
        {
          label: $t('dms_lang.actions.retry'),
          icon: 'i-ph-arrow-clockwise',
          color: 'neutral',
          variant: 'outline',
          loading: isLoading,
          onClick: () => reload(),
        },
      ]"
    />

    <div v-else-if="!isLoaded" class="divide-default divide-y">
      <div
        v-for="index in 6"
        :key="index"
        class="grid grid-cols-4 gap-4 px-4 py-4"
      >
        <USkeleton class="h-4 w-40" />
        <USkeleton class="h-4 w-full" />
        <USkeleton class="h-4 w-full" />
        <USkeleton class="h-4 w-3/4" />
      </div>
    </div>

    <DmsEmptyState
      v-else-if="!rows.length"
      :variant="flat.rows.length ? 'no-result' : 'no-data'"
      size="lg"
      hatched
      :title="
        flat.rows.length
          ? $t('dms_lang.matrix.no_match', { search: filters.search })
          : $t('dms_lang.matrix.no_keys')
      "
      :description="
        flat.rows.length
          ? $t(
              'dms_lang.matrix.no_match_description',
              { count: formatCount(flat.rows.length) },
              flat.rows.length,
            )
          : $t('dms_lang.matrix.no_keys_description')
      "
      :actions="[
        ...(flat.rows.length
          ? [
              {
                label: $t(
                  'dms_lang.matrix.show_all',
                  { count: formatCount(flat.rows.length) },
                  flat.rows.length,
                ),
                color: 'neutral',
                variant: 'outline',
                onClick: resetFilters,
              },
            ]
          : []),
        ...(canManageKeys
          ? [
              {
                label: filters.search
                  ? $t('dms_lang.matrix.add_named', { key: filters.search })
                  : $t('dms_lang.key_add.title'),
                icon: 'i-ph-plus',
                color: 'neutral',
                variant: 'ghost',
                onClick: () => addKey(),
              },
            ]
          : []),
      ]"
    />

    <div v-else-if="isCompact && compactColumn">
      <template v-for="group in view.rendered.value" :key="group.namespace">
        <div class="border-default border-b bg-(--dms-bg-muted) px-4 py-2">
          <MatrixGroupHeader
            :namespace="group.namespace"
            :keys="group.keys"
            :missing="group.missing"
            :collapsed="group.collapsed"
            @toggle="view.toggle(group.namespace)"
          />
        </div>
        <div
          v-for="row in group.shown"
          :key="row.key"
          class="border-default group/row space-y-2 border-b px-4 py-3"
          :data-editing="
            isEditingCell(row.key, compactColumn.code) || undefined
          "
        >
          <MatrixKeyCell
            :row-key="row.key"
            :is-done="isRowFinished(row)"
            :is-modules="isModules"
            :is-overridden="row.overridden === true"
            :can-override="serverEditable"
            @open="openKey(row.key, compactColumn.code)"
            @override="overrideKey(row)"
          />
          <p
            v-if="
              !compactColumn.isBase &&
              !isEditingCell(row.key, compactColumn.code)
            "
            class="text-dimmed line-clamp-3 text-xs"
          >
            <PlaceholderText :text="rowValue(row, flat.defaultLocale)" />
          </p>
          <MatrixCell
            v-bind="cellProps(row, compactColumn)"
            v-on="cellEvents(row, compactColumn)"
          />
        </div>
      </template>
      <div v-if="view.hasMore.value" ref="sentinel" class="h-8" />
    </div>

    <div v-else ref="scroller" class="max-h-[70vh] overflow-auto">
      <table
        role="grid"
        :aria-rowcount="rows.length"
        class="w-full table-fixed border-separate border-spacing-0 text-sm"
        :style="{ minWidth: tableMinWidth }"
        @keydown="onGridKeydown"
      >
        <colgroup>
          <col class="w-44 sm:w-64" />
          <col
            v-for="column in columns"
            :key="column.code"
            :class="todoLanguage ? 'w-[28rem]' : 'w-60'"
          />
        </colgroup>
        <thead class="sticky top-0 z-20 bg-(--dms-surface-card)">
          <tr>
            <th
              class="border-default sticky left-0 z-10 border-r border-b bg-(--dms-surface-card) px-4 py-2.5 text-left shadow-[4px_0_6px_-4px_rgb(0_0_0/0.25)]"
            >
              <DmsEyebrow :label="$t('dms_lang.matrix.key')" size="xs" />
            </th>
            <th
              v-for="column in columns"
              :key="column.code"
              class="border-default border-b border-l px-3 pt-2.5 pb-0 text-left font-normal"
            >
              <div class="flex items-center gap-2">
                <LocaleTile
                  :code="column.code"
                  size="sm"
                  :is-base="column.isBase"
                  :siblings="columnSiblings"
                />
                <span class="text-highlighted truncate font-medium">
                  {{ column.name }}
                </span>
                <DmsStatusPill
                  v-if="column.isBase"
                  dot="none"
                  tone="neutral"
                  size="sm"
                  :label="$t('dms_lang.common.base')"
                />
                <span
                  v-else
                  class="text-dimmed ml-auto font-mono text-[10.5px] whitespace-nowrap"
                >
                  {{
                    $t(
                      'dms_lang.matrix.column_missing',
                      { count: formatCount(column.missing) },
                      column.missing,
                    )
                  }}
                </span>
              </div>
              <div
                class="bg-elevated mt-2 h-0.5 w-full overflow-hidden rounded-full"
              >
                <div
                  class="h-full rounded-full"
                  :class="
                    column.isBase
                      ? 'bg-primary'
                      : BAR_CLASSES[coverageTone(column.coverage)]
                  "
                  :style="{ width: `${column.coverage}%` }"
                />
              </div>
            </th>
          </tr>
        </thead>
        <tbody v-for="group in view.rendered.value" :key="group.namespace">
          <tr>
            <td
              :colspan="columns.length + 1"
              class="border-default border-b bg-(--dms-bg-muted) py-1.5"
            >
              <div class="sticky left-0 inline-block px-4">
                <MatrixGroupHeader
                  :namespace="group.namespace"
                  :keys="group.keys"
                  :missing="group.missing"
                  :collapsed="group.collapsed"
                  @toggle="view.toggle(group.namespace)"
                />
              </div>
            </td>
          </tr>
          <tr
            v-for="row in group.shown"
            :key="row.key"
            class="group/row align-top"
          >
            <td
              class="border-default group-hover/row:bg-elevated/30 sticky left-0 z-10 border-r border-b bg-(--dms-surface-card) px-4 py-2.5 shadow-[4px_0_6px_-4px_rgb(0_0_0/0.25)]"
            >
              <MatrixKeyCell
                :row-key="row.key"
                :is-done="isRowFinished(row)"
                :is-modules="isModules"
                :is-overridden="row.overridden === true"
                :can-override="serverEditable"
                @open="openKey(row.key)"
                @override="overrideKey(row)"
              />
            </td>
            <td
              v-for="(column, columnIndex) in columns"
              :key="column.code"
              :data-row="rowIndex.get(row.key)"
              :data-col="columnIndex"
              :data-editing="isEditingCell(row.key, column.code) || undefined"
              class="border-default group-hover/row:bg-elevated/30 border-b border-l px-1.5 py-1"
            >
              <MatrixCell
                v-bind="cellProps(row, column)"
                v-on="cellEvents(row, column)"
              />
            </td>
          </tr>
        </tbody>
      </table>
      <div v-if="view.hasMore.value" ref="sentinel" class="h-8" />
    </div>

    <div
      v-if="isLoaded"
      class="border-default text-dimmed flex flex-wrap items-center gap-x-4 gap-y-1 border-t px-4 py-2 text-xs"
    >
      <span>
        {{
          $t(
            'dms_lang.matrix.footer_keys',
            { count: formatCount(counts.missing) },
            counts.missing,
          )
        }}
        ·
        {{
          $t(
            'dms_lang.matrix.footer_cells',
            { count: formatCount(counts.cells), languages: countedLabel },
            counts.cells,
          )
        }}
      </span>
      <span
        v-if="canEditValues && !isCompact"
        class="ml-auto inline-flex flex-wrap items-center gap-3"
      >
        <span class="inline-flex items-center gap-1">
          <UKbd size="sm" value="enter" />
          {{ $t('dms_lang.matrix.shortcut_save_down') }}
        </span>
        <span class="inline-flex items-center gap-1">
          <UKbd size="sm">Tab</UKbd>
          {{ $t('dms_lang.matrix.shortcut_next_cell') }}
        </span>
        <span class="inline-flex items-center gap-1">
          <UKbd size="sm">N</UKbd>
          /
          <UKbd size="sm" value="shift" />
          <UKbd size="sm">N</UKbd>
          {{ $t('dms_lang.matrix.shortcut_next_missing') }}
        </span>
        <span class="inline-flex items-center gap-1">
          <UKbd size="sm" value="meta" />
          <UKbd size="sm" value="shift" />
          <UKbd size="sm" value="enter" />
          {{ $t('dms_lang.matrix.open_panel') }}
        </span>
      </span>
    </div>
  </DmsCard>
</template>
