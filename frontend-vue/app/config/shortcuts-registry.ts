import {
  KEY_PANEL_KEYS,
  MATRIX_KEYS,
  QUEUE_KEYS,
  shortcutGroup,
} from '../utils/shortcuts'

export default [
  shortcutGroup('translation_queue', [
    { keys: QUEUE_KEYS.saveNext, description: 'queue.save_next' },
    { keys: QUEUE_KEYS.save, description: 'queue.save' },
    {
      keys: QUEUE_KEYS.leaveField,
      description: 'queue.leave_field',
      condition: 'queue.in_field',
    },
    {
      keys: QUEUE_KEYS.skip,
      description: 'queue.skip',
      condition: 'queue.outside_field',
    },
    {
      keys: QUEUE_KEYS.previous,
      description: 'queue.previous',
      condition: 'queue.outside_field',
    },
  ]),
  shortcutGroup('translation_matrix', [
    {
      keys: MATRIX_KEYS.nextMissing,
      description: 'matrix.next_missing',
      condition: 'matrix.outside_field',
    },
    {
      keys: MATRIX_KEYS.previousMissing,
      description: 'matrix.previous_missing',
      condition: 'matrix.outside_field',
    },
    {
      keys: MATRIX_KEYS.saveDown,
      description: 'matrix.save_down',
      condition: 'matrix.in_cell',
    },
    {
      keys: MATRIX_KEYS.newLine,
      description: 'matrix.new_line',
      condition: 'matrix.in_cell',
    },
    {
      keys: MATRIX_KEYS.nextCell,
      description: 'matrix.next_cell',
      condition: 'matrix.in_cell',
    },
    {
      keys: MATRIX_KEYS.cancel,
      description: 'matrix.cancel',
      condition: 'matrix.in_cell',
    },
    {
      keys: MATRIX_KEYS.openPanel,
      description: 'matrix.open_panel',
      condition: 'matrix.in_cell',
    },
  ]),
  shortcutGroup('key_panel', [
    {
      keys: KEY_PANEL_KEYS.saveNext,
      description: 'key_panel.save_next',
      condition: 'key_panel.in_field',
    },
  ]),
] satisfies ComponentShortcuts[]
