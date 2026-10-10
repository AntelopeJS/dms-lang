export type TranslationValue = string | number | boolean | null | undefined

export type WorkspaceKind = 'default' | 'modules' | 'added'

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
}

export interface WorkspaceStats extends WorkspaceSummary {
  baseLocale: string
  totalKeys: number
  translatedStrings: number
  missing: number
  coverage: number
  localeProgress: Record<string, number>
  localeMissing: Record<string, number>
  overrides: number
}

export interface FlatTranslationRow {
  key: string
  values: Record<string, TranslationValue>
  /** Value the installed modules give the key, in the project files workspace. */
  inherited?: Record<string, TranslationValue>
  /** The project files redefine this module key. */
  overridden?: boolean
}

export interface FlatTranslations {
  defaultLocale: string
  locales: string[]
  rows: FlatTranslationRow[]
  localeProgress: Record<string, number>
  localeMissing: Record<string, number>
  totalKeys: number
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
