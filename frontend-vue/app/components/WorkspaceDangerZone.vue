<script setup lang="ts">
import { translatedCount } from '../utils/translations'

const { t } = useI18n()
const { canManage, isUnknown, allows } = useWorkspaceContext()
const { flat } = useWorkspaceFlat()
const { renameWorkspace, deleteWorkspace, downloadBackup } =
  useWorkspaceActions()
const { route } = useWorkspaceRoute()
const links = useLangLinks()

const workspaceId = computed(() => route.query.workspace ?? '')
const files = computed(() => flat.value.locales.length)
const strings = computed(() =>
  flat.value.locales.reduce(
    (total, code) => total + translatedCount(flat.value.rows, code),
    0,
  ),
)
const deleteHelp = computed(() =>
  t('dms_lang.workspace.delete_help', {
    files: t('dms_lang.workspace.delete_files', files.value),
    strings: t('dms_lang.workspace.delete_strings', strings.value),
  }),
)

function remove() {
  return deleteWorkspace(workspaceId.value, {
    files: files.value,
    strings: strings.value,
  })
}
</script>

<template>
  <DmsSection
    v-if="canManage && !isUnknown"
    danger
    :title="$t('dms_lang.workspace.danger_title')"
  >
    <DmsFieldRow
      layout="inline"
      :label="$t('dms_lang.workspace.backup_title')"
      :description="$t('dms_lang.workspace.backup_help')"
    >
      <UButton
        color="neutral"
        variant="outline"
        size="sm"
        icon="i-ph-download-simple"
        :label="$t('dms_lang.workspace.backup')"
        @click="downloadBackup(workspaceId)"
      />
    </DmsFieldRow>
    <DmsFieldRow
      v-if="allows('renameWorkspace')"
      layout="inline"
      :label="$t('dms_lang.workspace.rename_title')"
      :description="
        $t('dms_lang.workspace.rename_help', {
          url: links.publicLocaleUrl(workspaceId),
        })
      "
    >
      <UButton
        color="warning"
        variant="outline"
        size="sm"
        :label="$t('dms_lang.workspace.rename')"
        @click="renameWorkspace(workspaceId)"
      />
    </DmsFieldRow>
    <DmsFieldRow
      v-if="allows('deleteWorkspace')"
      layout="inline"
      :label="$t('dms_lang.workspace.delete_title')"
      :description="deleteHelp"
    >
      <UButton
        color="error"
        variant="outline"
        size="sm"
        icon="i-ph-trash"
        :label="$t('dms_lang.workspace.delete')"
        @click="remove"
      />
    </DmsFieldRow>
  </DmsSection>
</template>
