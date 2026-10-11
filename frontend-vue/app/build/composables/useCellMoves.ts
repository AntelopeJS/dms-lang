import type { Ref } from 'vue'
import type { FlatTranslationRow } from '../../types/lang'
import type { CellMove, CellRef } from './useCellEditor'
import type { MatrixGroup } from './useMatrixFilters'
import type { useMatrixRows } from './useMatrixRows'

/** Forward or backward through the cells. */
export type JumpStep = 1 | -1

export interface CellMovesOptions {
  view: ReturnType<typeof useMatrixRows>
  groups: Ref<MatrixGroup[]>
  columnCodes: Ref<string[]>
  targets: Ref<string[]>
  baseLocale: () => string
  isPending: (key: string, code: string) => boolean
}

type MoveTarget = (options: CellMovesOptions, cell: CellRef) => CellRef | null

const TYPING_FIELDS = 'input, textarea, select, [contenteditable]'
const GRID_CELL = 'td[data-row]'
const ARROW_STEPS: Record<string, [number, number]> = {
  ArrowUp: [-1, 0],
  ArrowDown: [1, 0],
  ArrowLeft: [0, -1],
  ArrowRight: [0, 1],
}

function navigableCodes(options: CellMovesOptions, code: string): string[] {
  const base = options.baseLocale()
  const codes = options.columnCodes.value
  if (code === base || codes.length === 1) return codes
  return codes.filter((entry) => entry !== base)
}

function neighbourRow(
  options: CellMovesOptions,
  key: string,
  step: JumpStep,
): string | undefined {
  const { view } = options
  const shown = view.renderedRows.value
  const index = shown.findIndex((row) => row.key === key)
  if (step > 0 && index === shown.length - 1 && view.hasMore.value)
    view.showMore()
  return view.renderedRows.value[index + step]?.key
}

function sideCell(
  options: CellMovesOptions,
  cell: CellRef,
  step: JumpStep,
): CellRef | null {
  const codes = navigableCodes(options, cell.code)
  const next = codes[codes.indexOf(cell.code) + step]
  if (next) return { key: cell.key, code: next }
  const row = neighbourRow(options, cell.key, step)
  if (!row) return null
  return { key: row, code: step > 0 ? codes[0] : codes[codes.length - 1] }
}

const MOVES: Record<CellMove, MoveTarget> = {
  stay: () => null,
  down: (options, cell) => {
    const row = neighbourRow(options, cell.key, 1)
    return row ? { key: row, code: cell.code } : null
  },
  next: (options, cell) => sideCell(options, cell, 1),
  previous: (options, cell) => sideCell(options, cell, -1),
}

function missingOfRow(
  options: CellMovesOptions,
  row: FlatTranslationRow,
  codes: string[],
): CellRef[] {
  return codes
    .filter(
      (code) =>
        isRowValueMissing(row, code) && !options.isPending(row.key, code),
    )
    .map((code) => ({ key: row.key, code }))
}

function missingCells(options: CellMovesOptions): CellRef[] {
  const codes = options.columnCodes.value.filter((code) =>
    options.targets.value.includes(code),
  )
  return options.groups.value.flatMap((group) =>
    group.rows.flatMap((row) => missingOfRow(options, row, codes)),
  )
}

function cellIndex(cell: CellRef, keys: string[], codes: string[]): number {
  return keys.indexOf(cell.key) * codes.length + codes.indexOf(cell.code)
}

function pickMissing(
  options: CellMovesOptions,
  from: CellRef | null,
  step: JumpStep,
): CellRef | undefined {
  const cells = missingCells(options)
  if (!from) return step > 0 ? cells[0] : cells.at(-1)
  const keys = options.groups.value.flatMap((group) =>
    group.rows.map((row) => row.key),
  )
  const codes = options.columnCodes.value
  const origin = cellIndex(from, keys, codes)
  const ordered = step > 0 ? cells : [...cells].reverse()
  const found = ordered.find(
    (cell) => step * (cellIndex(cell, keys, codes) - origin) > 0,
  )
  return found ?? ordered[0]
}

/** Whether a key goes to a field being typed in. */
export function isTypingTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && target.closest(TYPING_FIELDS) !== null
}

/** Arrow keys move the focus between the cells of the grid, as in a spreadsheet. */
export function focusNeighbourCell(
  event: KeyboardEvent,
  grid: HTMLElement | undefined,
) {
  const step = ARROW_STEPS[event.key]
  const cell =
    event.target instanceof HTMLElement
      ? event.target.closest<HTMLElement>(GRID_CELL)
      : null
  if (!step || !cell || isTypingTarget(event.target)) return
  const row = Number(cell.dataset.row) + step[0]
  const column = Number(cell.dataset.col) + step[1]
  const target = grid?.querySelector<HTMLElement>(
    `td[data-row="${row}"][data-col="${column}"] button`,
  )
  if (!target) return
  event.preventDefault()
  target.focus()
}

/**
 * Where the editor goes from a cell: down, to the next or the previous cell
 * of the languages one translates (the base only when one edits it), or to
 * the next empty cell of the counted languages.
 */
export function useCellMoves(options: CellMovesOptions) {
  return {
    targetOf: (cell: CellRef, move: CellMove) => MOVES[move](options, cell),
    nextMissing: (from: CellRef | null, step: JumpStep) =>
      pickMissing(options, from, step),
  }
}
