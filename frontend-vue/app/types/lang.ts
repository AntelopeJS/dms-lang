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
}

export interface FlatTranslations {
  defaultLocale: string
  locales: string[]
  rows: FlatTranslationRow[]
  localeProgress: Record<string, number>
  localeMissing: Record<string, number>
  totalKeys: number
  baseMissing: number
  incompleteKeys: number
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

export type TranslationFilter = 'all' | 'missing' | 'complete' | 'issues'
