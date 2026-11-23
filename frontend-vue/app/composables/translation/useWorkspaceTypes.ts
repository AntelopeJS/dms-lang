import type { WorkspaceKind, WorkspaceType } from '../../types/lang'

const WORKSPACE_DESCRIPTION_MAX = 500

const TYPE_ICONS: Record<WorkspaceType, string> = {
  dms: 'i-ph-squares-four',
  website: 'i-ph-globe',
  mobile: 'i-ph-device-mobile',
  other: 'i-ph-shapes',
}

const KIND_ICONS: Record<WorkspaceKind, string> = {
  default: 'i-ph-file-code',
  added: 'i-ph-stack',
  modules: 'i-ph-puzzle-piece',
}

function isWorkspaceType(value: unknown): value is WorkspaceType {
  return typeof value === 'string' && Object.hasOwn(TYPE_ICONS, value)
}

/** The kinds of app a workspace serves, as a picker offers them, and the icon of each kind of workspace. */
export const useWorkspaceTypes = () => {
  const { t } = useI18n()
  const typeItems = computed(() =>
    Object.keys(TYPE_ICONS)
      .filter(isWorkspaceType)
      .map((value) => ({
        value,
        label: t(`dms_lang.workspace_types.${value}`),
        icon: TYPE_ICONS[value],
      })),
  )
  const typeIcon = (type: WorkspaceType) => TYPE_ICONS[type]
  const typeOf = (value: unknown): WorkspaceType | undefined =>
    isWorkspaceType(value) ? value : undefined
  const typeLabel = (type: WorkspaceType) =>
    t(`dms_lang.workspace_types.${type}`)
  return {
    typeItems,
    typeIcon,
    typeLabel,
    typeOf,
    kindIcon: (kind: WorkspaceKind) => KIND_ICONS[kind],
    descriptionMax: WORKSPACE_DESCRIPTION_MAX,
  }
}
