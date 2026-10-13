import type {
  WorkspaceDetails,
  WorkspaceLocale,
  WorkspaceType,
} from '../types/lang'

/** The messages of each language of a workspace. */
export type LocaleMessages = Record<string, Record<string, unknown>>

/** A workspace saved as one JSON file: its manifest and every language file. */
export interface WorkspaceBackup extends WorkspaceDetails {
  format?: string
  version?: number
  id?: string
  defaultLocale?: string
  locales?: WorkspaceLocale[]
  messages: LocaleMessages
}

/** The description and type a request sends: `null` clears them. */
export interface DetailsChange {
  description?: string | null
  type?: WorkspaceType | null
}

/** A backup as an import sends it: its details may be cleared. */
export type WorkspaceImport = Omit<WorkspaceBackup, keyof WorkspaceDetails> &
  DetailsChange

/** Why a file is no workspace: not one at all, or a backup of a newer format. */
export type BackupProblem = 'invalid' | 'newer'

/** A file read as a workspace backup. */
interface BackupFound {
  backup: WorkspaceBackup
  problem?: undefined
}

/** A file that is no workspace backup, and why. */
interface BackupRefused {
  backup?: undefined
  problem: BackupProblem
}

/** What a file holds as a workspace: a backup, else why it is none. */
export type BackupRead = BackupFound | BackupRefused

/** The format every backup declares. */
export const BACKUP_FORMAT = 'dms-lang.workspace'
/** The newest backup version this module reads. */
export const BACKUP_VERSION = 1

const JSON_EXTENSION_RE = /\.json$/i
const INVALID: BackupRead = { problem: 'invalid' }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isLocaleMessages(value: unknown): value is LocaleMessages {
  if (!isRecord(value)) return false
  const entries = Object.entries(value)
  return (
    entries.length > 0 &&
    entries.every(
      ([code, messages]) => typedLocaleCode(code) && isRecord(messages),
    )
  )
}

function isKnownVersion(version: unknown): version is number {
  return typeof version === 'number' && Number.isInteger(version) && version > 0
}

/**
 * What is wrong with a backup's `format` and `version`: another format, a
 * version that is no version, or one newer than this module reads. Both may
 * be left out (a backup written by hand).
 */
function backupProblem(
  content: Record<string, unknown>,
): BackupProblem | undefined {
  const { format, version } = content
  if (format !== undefined && format !== BACKUP_FORMAT) return 'invalid'
  if (version === undefined) return undefined
  if (!isKnownVersion(version)) return 'invalid'
  return version > BACKUP_VERSION ? 'newer' : undefined
}

function backupRead(content: Record<string, unknown>): BackupRead {
  const problem = backupProblem(content)
  if (problem) return { problem }
  return { backup: content as unknown as WorkspaceBackup }
}

/**
 * What a JSON file holds as a workspace: a backup (`messages` and its
 * manifest, of a format and version this module reads), an export of every
 * language (`{ <locale>: messages }`), or one language file named after its
 * code (`it.json`).
 */
export function readBackup(content: unknown, fileName = ''): BackupRead {
  if (isRecord(content) && isLocaleMessages(content.messages))
    return backupRead(content)
  if (isLocaleMessages(content)) return { backup: { messages: content } }
  const code = typedLocaleCode(fileName.replace(JSON_EXTENSION_RE, ''))
  if (code && isRecord(content))
    return { backup: { messages: { [code]: content } } }
  return INVALID
}

/** Reads a JSON file as a workspace; a file that is no JSON is no workspace. */
export function parseBackup(text: string, fileName: string): BackupRead {
  try {
    return readBackup(JSON.parse(text), fileName)
  } catch {
    return INVALID
  }
}
