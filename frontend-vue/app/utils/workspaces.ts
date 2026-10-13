/** The HTTP method an app reads an added workspace's public files with. */
export const PUBLIC_URL_METHOD = 'GET'

/** `kind` keeps the order of the server: project files, modules, then the workspaces created. */
export type WorkspaceSort = 'kind' | 'name' | 'coverage'

export interface ListedWorkspace {
  id: string
  description?: string
  coverage: number
}

type WorkspaceComparator = (a: ListedWorkspace, b: ListedWorkspace) => number

const byName: WorkspaceComparator = (a, b) => a.id.localeCompare(b.id)

const WORKSPACE_COMPARATORS: Record<WorkspaceSort, WorkspaceComparator> = {
  kind: () => 0,
  name: byName,
  coverage: (a, b) => a.coverage - b.coverage || byName(a, b),
}

/**
 * Whether a workspace's id, description or one of the `labels` shown for it
 * (its kind, its type) holds the search, ignoring case.
 */
export function matchesWorkspace(
  workspace: ListedWorkspace,
  search: string,
  labels: string[] = [],
): boolean {
  const needle = search.trim().toLowerCase()
  if (!needle) return true
  return [workspace.id, workspace.description ?? '', ...labels].some((text) =>
    text.toLowerCase().includes(needle),
  )
}

/** The workspaces in the order picked; least complete first by coverage. */
export function sortWorkspaces<T extends ListedWorkspace>(
  workspaces: T[],
  sort: WorkspaceSort,
): T[] {
  return [...workspaces].sort(WORKSPACE_COMPARATORS[sort])
}
