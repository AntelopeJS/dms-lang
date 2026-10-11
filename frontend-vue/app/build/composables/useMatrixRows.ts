import type { Ref } from 'vue'
import type { FlatTranslationRow } from '../../types/lang'
import type { MatrixGroup } from './useMatrixFilters'

interface RenderedGroup extends MatrixGroup {
  collapsed: boolean
  /** The rows drawn so far: more come as the user scrolls. */
  shown: FlatTranslationRow[]
}

const ROW_BATCH = 100
const COLLAPSE_ABOVE = 300

interface RowsContext {
  groups: Ref<MatrixGroup[]>
  toggled: Ref<Set<string>>
  limit: Ref<number>
  foldsByDefault: Ref<boolean>
}

function isCollapsed(context: RowsContext, namespace: string): boolean {
  return context.foldsByDefault.value !== context.toggled.value.has(namespace)
}

function toggle(context: RowsContext, namespace: string) {
  const next = new Set(context.toggled.value)
  if (next.has(namespace)) next.delete(namespace)
  else next.add(namespace)
  context.toggled.value = next
}

function costOf(context: RowsContext, group: MatrixGroup): number {
  return isCollapsed(context, group.namespace) ? 1 : group.rows.length + 1
}

function renderedGroups(context: RowsContext): RenderedGroup[] {
  let budget = context.limit.value
  const result: RenderedGroup[] = []
  for (const group of context.groups.value) {
    if (budget <= 0) break
    const collapsed = isCollapsed(context, group.namespace)
    const shown = collapsed ? [] : group.rows.slice(0, budget - 1)
    budget -= shown.length + 1
    result.push({ ...group, collapsed, shown })
  }
  return result
}

function reveal(context: RowsContext, key: string) {
  let position = 0
  for (const group of context.groups.value) {
    const index = group.rows.findIndex((row) => row.key === key)
    if (index >= 0) {
      if (isCollapsed(context, group.namespace))
        toggle(context, group.namespace)
      context.limit.value = Math.max(
        context.limit.value,
        position + index + ROW_BATCH,
      )
      return
    }
    position += costOf(context, group)
  }
}

/**
 * Which rows of the matrix are drawn: namespaces fold by default on large
 * workspaces, and rows are drawn in batches as the end of the list scrolls
 * into view (no "Show more" to click), so thousands of keys stay fluid.
 */
export function useMatrixRows(
  groups: Ref<MatrixGroup[]>,
  rowCount: Ref<number>,
) {
  const context: RowsContext = {
    groups,
    toggled: ref<Set<string>>(new Set()),
    limit: ref(ROW_BATCH),
    foldsByDefault: computed(
      () => rowCount.value > COLLAPSE_ABOVE && groups.value.length > 1,
    ),
  }
  const rendered = computed(() => renderedGroups(context))
  const cost = computed(() =>
    groups.value.reduce((sum, group) => sum + costOf(context, group), 0),
  )

  return {
    rendered,
    renderedRows: computed(() =>
      rendered.value.flatMap((group) => group.shown),
    ),
    hasMore: computed(() => cost.value > context.limit.value),
    toggle: (namespace: string) => toggle(context, namespace),
    showMore() {
      context.limit.value += ROW_BATCH
    },
    reveal: (key: string) => reveal(context, key),
    reset() {
      context.toggled.value = new Set()
      context.limit.value = ROW_BATCH
    },
  }
}
