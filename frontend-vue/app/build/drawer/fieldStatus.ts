export type FieldStatus =
  'missing' | 'inherited' | 'overridden' | 'outdated' | 'done'

export const BASE_MISSING_LABEL = 'dms_lang.matrix.source_missing'
export const FIELD_STATUS_LABELS: Record<FieldStatus, string> = {
  missing: 'dms_lang.matrix.missing',
  inherited: 'dms_lang.drawer.inherited',
  overridden: 'dms_lang.drawer.overridden',
  outdated: 'dms_lang.drawer.outdated',
  done: '',
}
