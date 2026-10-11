import type { Ref } from 'vue'
import type { FlatTranslationRow } from '../../types/lang'
import type { MatrixGroup } from './useMatrixFilters'

interface RenderedGroup extends MatrixGroup {
  collapsed: boolean
  /** The rows drawn so far: more come as the user scrolls. */
  shown: FlatTranslationRow[]
}

/** Rows drawn at first, and added each time the end of the list comes into view. */
const ROW_BATCH = 100
/** Above this many keys, namespaces start folded: one opens what one needs. */
const COLLAPSE_ABOVE = 300

/**
 * Which rows of the matrix are drawn: namespaces fold by default on large
 * workspaces, and rows are drawn in batches as the end of the list scrolls
 * into view (no "Show more" to click), so thousands of keys stay fluid.
 */
export function useMatrixRows(
  groups: Ref<MatrixGroup[]>,
  rowCount: Ref<number>,
) {
  const toggled = ref<Set<string>>(new Set())
  const limit = ref(ROW_BATCH)

  const foldsByDefault = computed(
    () => rowCount.value > COLLAPSE_ABOVE && groups.value.length > 1,
  )

  function isCollapsed(namespace: string): boolean {
    return foldsByDefault.value !== toggled.value.has(namespace)
  }

  function toggle(namespace: string) {
    const next = new Set(toggled.value)
    if (next.has(namespace)) next.delete(namespace)
    else next.add(namespace)
    toggled.value = next
  }

  function expand(namespace: string) {
    if (isCollapsed(namespace)) toggle(namespace)
  }

  /** Each group costs its header and its open rows. */
  function costOf(group: MatrixGroup): number {
    return isCollapsed(group.namespace) ? 1 : group.rows.length + 1
  }

  const rendered = computed<RenderedGroup[]>(() => {
    let budget = limit.value
    const result: RenderedGroup[] = []
    for (const group of groups.value) {
      if (budget <= 0) break
      const collapsed = isCollapsed(group.namespace)
      const shown = collapsed ? [] : group.rows.slice(0, budget - 1)
      budget -= shown.length + 1
      result.push({ ...group, collapsed, shown })
    }
    return result
  })

  const renderedRows = computed(() =>
    rendered.value.flatMap((group) => group.shown),
  )

  const hasMore = computed(
    () =>
      groups.value.reduce((sum, group) => sum + costOf(group), 0) > limit.value,
  )

  function showMore() {
    limit.value += ROW_BATCH
  }

  /** Opens a key's namespace and draws rows down to it. */
  function reveal(key: string) {
    let position = 0
    for (const group of groups.value) {
      if (group.rows.some((row) => row.key === key)) {
        expand(group.namespace)
        const index = group.rows.findIndex((row) => row.key === key)
        limit.value = Math.max(limit.value, position + index + ROW_BATCH)
        return
      }
      position += costOf(group)
    }
  }

  function reset() {
    toggled.value = new Set()
    limit.value = ROW_BATCH
  }

  return {
    rendered,
    renderedRows,
    hasMore,
    isCollapsed,
    toggle,
    showMore,
    reveal,
    reset,
  }
}
