export type TranslationValue = string | number | boolean | null | undefined

export type WorkspaceKind = 'default' | 'modules' | 'added'

export type WorkspaceType = 'dms' | 'website' | 'mobile' | 'other'

export interface WorkspaceLocale {
  code: string
  name?: string
  flag?: string
}

export interface WorkspaceSummary {
  id: string
  kind: WorkspaceKind
  editable: boolean
  defaultLocale: string
  locales: WorkspaceLocale[]
  description?: string
  type?: WorkspaceType
  /** Public URL of a language file, with a `{locale}` placeholder; added workspaces only. */
  publicUrl?: string
}

/** A workspace as /workspaces lists it: its number of keys, of keys without base text and of texts. */
export interface ScopedWorkspace extends WorkspaceSummary {
  totalKeys: number
  baseMissing: number
  translatedStrings: number
}

export interface WorkspaceDetails {
  description?: string
  type?: WorkspaceType
}

/** DMS permission ids guarding each kind of write, as /workspaces lists them. */
export interface WorkspacePermissionIds {
  editTranslations: string
  manageKeys: string
  manageLanguages: string
  createWorkspace: string
  renameWorkspace: string
  deleteWorkspace: string
  editWorkspace: string
}

export type WorkspacePermission = keyof WorkspacePermissionIds

export interface WorkspaceStats extends WorkspaceSummary {
  baseLocale: string
  totalKeys: number
  translatedStrings: number
  missing: number
  coverage: number
  localeProgress: Record<string, number>
  localeMissing: Record<string, number>
  overrides: number
  baseMissing: number
  incompleteKeys: number
  targets: number
}

export interface FlatTranslationRow {
  key: string
  values: Record<string, TranslationValue>
  /** Value the installed modules give the key, in the project files workspace. */
  inherited?: Record<string, TranslationValue>
  /** The project files redefine this module key. */
  overridden?: boolean
  /** In the modules workspace, the values the project files redefine. */
  overrides?: Record<string, string>
  /** Languages translated from an older base text. */
  outdated?: string[]
  /** Languages whose text has an issue, as the server checks it. */
  issues?: string[]
}

/** The figures of a workspace a write changes. */
export interface FlatCounts {
  localeProgress: Record<string, number>
  localeMissing: Record<string, number>
  totalKeys: number
  baseMissing: number
  incompleteKeys: number
}

export interface FlatTranslations extends FlatCounts {
  defaultLocale: string
  locales: string[]
  rows: FlatTranslationRow[]
}

/** What a write to one key answers: the row as the server now stores it (none once the key is gone) and the figures it changed. */
export interface KeyRowResponse {
  row?: FlatTranslationRow
  counts: FlatCounts
}

export interface LanguageCoverage {
  code: string
  name: string
  isBase: boolean
  coverage: number
  translated: number
  missing: number
}

export interface NamespaceCoverage {
  namespace: string
  keys: number
  coverage: Record<string, number>
  missing: Record<string, number>
}

/** One namespace of the overview heatmap: its keys and how many each target language lacks. */
export interface NamespaceRow {
  namespace: string
  keys: number
  missing: Record<string, number>
}

/** The overview heatmap as /namespaces answers it: the targets and the namespaces, neediest first. */
export interface NamespaceMatrix {
  locales: string[]
  localeMissing: Record<string, number>
  namespaces: NamespaceRow[]
}

export type TranslationFilter = 'all' | 'missing' | 'complete' | 'issues'
