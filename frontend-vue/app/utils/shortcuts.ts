/** A key combination, each key named as `defineShortcuts` names it (`meta`, `enter`, `s`). */
export type ShortcutKeys = readonly string[]

/** The description and the condition of a shortcut, as i18n keys of the module. */
interface ShortcutText {
  keys: ShortcutKeys
  description: string
  condition?: string
}

const KEYBOARD_TEXTS = '$keyboard.'
const TEXTS = '$dms_lang.shortcuts'
const COMBINATION_SEPARATOR = '_'
/** Named keys the DMS keyboard texts do not cover. */
const OWN_KEY_TEXTS: Record<string, string> = {
  tab: `${TEXTS}.keys.tab`,
}

/** The keys of the translation queue. */
export const QUEUE_KEYS = {
  saveNext: ['meta', 'enter'],
  save: ['meta', 's'],
  leaveField: ['escape'],
  skip: ['s'],
  previous: ['p'],
} as const satisfies Record<string, ShortcutKeys>

/** The keys of the translation matrix. */
export const MATRIX_KEYS = {
  nextMissing: ['n'],
  previousMissing: ['shift', 'n'],
  saveDown: ['enter'],
  newLine: ['shift', 'enter'],
  nextCell: ['tab'],
  cancel: ['escape'],
  openPanel: ['meta', 'shift', 'enter'],
} as const satisfies Record<string, ShortcutKeys>

/** The keys of the key side panel. */
export const KEY_PANEL_KEYS = {
  saveNext: ['meta', 'enter'],
} as const satisfies Record<string, ShortcutKeys>

/** The name `defineShortcuts` binds a combination under (`meta_enter`). */
export function shortcutName(keys: ShortcutKeys): string {
  return keys.join(COMBINATION_SEPARATOR)
}

/** A key as the Shortcuts settings page prints it: named keys through the DMS keyboard texts. */
function registryKey(key: string): string {
  if (key.length === 1) return key
  return Object.hasOwn(OWN_KEY_TEXTS, key)
    ? OWN_KEY_TEXTS[key]
    : `${KEYBOARD_TEXTS}${key}`
}

function metadataOf(component: string, text: ShortcutText): ShortcutMetadata {
  return {
    key: text.keys.map(registryKey),
    descriptionKey: `${TEXTS}.${text.description}`,
    component,
    ...(text.condition
      ? { condition: { descriptionKey: `${TEXTS}.${text.condition}` } }
      : {}),
  }
}

/** The shortcuts of a component, as the DMS shortcuts registry lists them. */
export function shortcutGroup(component: string, texts: ShortcutText[]) {
  const name = `${TEXTS}.groups.${component}`
  return {
    component: name,
    shortcuts: texts.map((text) => metadataOf(name, text)),
  }
}
