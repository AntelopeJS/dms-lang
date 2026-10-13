import type { FlatTranslationRow } from '../types/lang'

const BYTE_ORDER_MARK = '﻿'
const LINE_BREAK = '\r\n'
const SEPARATOR = ','
/** Spreadsheets run a cell starting with one of these as a formula. */
const FORMULA_START = /^[=+\-@\t\r]/
const FORMULA_GUARD = "'"

function csvCell(value: unknown): string {
  const text = stringValue(value)
  const safe = FORMULA_START.test(text) ? `${FORMULA_GUARD}${text}` : text
  return `"${safe.replaceAll('"', '""')}"`
}

/**
 * A CSV of translations that spreadsheets open as written: UTF-8 with a byte
 * order mark (accents survive Excel), CRLF lines, the base language first and
 * cells that look like formulas kept as text.
 */
export function translationsCsv(
  rows: FlatTranslationRow[],
  locales: string[],
): string {
  const lines = [
    ['key', ...locales].map(csvCell).join(SEPARATOR),
    ...rows.map((row) =>
      [row.key, ...locales.map((code) => row.values[code])]
        .map(csvCell)
        .join(SEPARATOR),
    ),
  ]
  return `${BYTE_ORDER_MARK}${lines.join(LINE_BREAK)}${LINE_BREAK}`
}

/**
 * The file an export downloads: the whole workspace and a filtered view never
 * share a name (`site-all.csv`, `site-view-en_de.csv`).
 */
export function exportFileName(
  workspace: string,
  viewLocales?: string[],
): string {
  return viewLocales
    ? `${workspace}-view-${viewLocales.join('_')}.csv`
    : `${workspace}-all.csv`
}
