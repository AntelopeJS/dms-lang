import { useDmsState } from '#dms/frontend-module'
import type { FlatTranslationRow } from '../../types/lang'

export type QueueMode = 'missing' | 'issues' | 'all'

/**
 * The language a Language page works on (`?locale=`) and the queue of keys it
 * walks through, shared by the queue and its side panels.
 */
export const useLanguageQueue = () => {
  const { route } = useWorkspaceRoute()
  const { flat } = useWorkspaceFlat()
  const mode = useDmsState<QueueMode>('dms-lang-queue-mode', () => 'missing')
  const namespace = useDmsState<string>('dms-lang-queue-namespace', () => '')

  const locale = computed(() => route.query.locale ?? '')
  const baseLocale = computed(() => flat.value.defaultLocale)
  const isBase = computed(() => locale.value === baseLocale.value)
  const exists = computed(() => flat.value.locales.includes(locale.value))

  function isMissing(row: FlatTranslationRow): boolean {
    return isRowValueMissing(row, locale.value)
  }

  function hasIssue(row: FlatTranslationRow): boolean {
    return rowHasIssue(row, baseLocale.value, locale.value)
  }

  const MODES: Record<QueueMode, (row: FlatTranslationRow) => boolean> = {
    missing: isMissing,
    issues: hasIssue,
    all: () => true,
  }

  const scoped = computed(() =>
    flat.value.rows.filter(
      (row) => !namespace.value || namespaceOf(row.key) === namespace.value,
    ),
  )
  const queue = computed(() => scoped.value.filter(MODES[mode.value]))
  const counts = computed(() => ({
    missing: scoped.value.filter(isMissing).length,
    issues: scoped.value.filter(hasIssue).length,
    all: scoped.value.length,
  }))
  const translated = computed(
    () => flat.value.rows.filter((row) => !isMissing(row)).length,
  )
  const issueTotal = computed(() => flat.value.rows.filter(hasIssue).length)

  return {
    locale,
    baseLocale,
    isBase,
    exists,
    mode,
    namespace,
    queue,
    counts,
    translated,
    issueTotal,
    isMissing,
    hasIssue,
  }
}
