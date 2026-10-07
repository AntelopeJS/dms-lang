<script setup lang="ts">
import { translatedCount } from '../utils/translations'

const WORKSPACES_FOLDER = 'i18n-workspaces'

const { t } = useI18n()
const { formatCount } = useLangFormat()
const { current, isEditable } = useWorkspaceContext()
const { flat, isLoaded } = useWorkspaceFlat()

const strings = computed(() =>
  flat.value.locales.reduce(
    (total, code) => total + translatedCount(flat.value.rows, code),
    0,
  ),
)

const items = computed(() => [
  {
    id: 'kind',
    label: t('dms_lang.about.kind'),
    value: current.value
      ? t(`dms_lang.workspace_kinds.${current.value.kind}.kind`)
      : null,
  },
  {
    id: 'editable',
    label: t('dms_lang.about.editable'),
    value: isEditable.value ? t('dms_lang.about.yes') : t('dms_lang.about.no'),
    tone: isEditable.value ? ('success' as const) : ('warning' as const),
  },
  {
    id: 'keys',
    label: t('dms_lang.about.keys'),
    value: formatCount(flat.value.totalKeys),
    type: 'mono' as const,
    loading: !isLoaded.value,
  },
  {
    id: 'strings',
    label: t('dms_lang.about.strings'),
    value: formatCount(strings.value),
    type: 'mono' as const,
    loading: !isLoaded.value,
  },
  {
    id: 'folder',
    label: t('dms_lang.about.folder'),
    value:
      current.value?.kind === 'added'
        ? `${WORKSPACES_FOLDER}/${current.value.id}`
        : t(
            `dms_lang.workspace_kinds.${current.value?.kind ?? 'default'}.folder`,
          ),
    type: 'mono' as const,
  },
])
</script>

<template>
  <DmsCard :padded="false" :title="$t('dms_lang.about.title')">
    <div class="px-4 py-1">
      <DmsKeyValueList :items="items" dense />
    </div>
  </DmsCard>
</template>
