<script setup lang="ts">
import { useDmsRouter } from '#dms/frontend-module'
import { translatedCount } from '../utils/translations'

const { canManage } = useWorkspaceContext()
const { flat } = useWorkspaceFlat()
const { renameWorkspace, deleteWorkspace } = useWorkspaceActions()
const { route } = useWorkspaceRoute()
const router = useDmsRouter()
const links = useLangLinks()

const workspaceId = computed(() => route.query.workspace ?? '')
const strings = computed(() =>
  flat.value.locales.reduce(
    (total, code) => total + translatedCount(flat.value.rows, code),
    0,
  ),
)

async function rename() {
  const renamed = await renameWorkspace(workspaceId.value)
  if (renamed) await router.replace(links.workspaceSettings(renamed))
}

async function remove() {
  const deleted = await deleteWorkspace(workspaceId.value, {
    files: flat.value.locales.length,
    strings: strings.value,
  })
  if (deleted) await router.push(links.workspaces())
}
</script>

<template>
  <DmsSection
    v-if="canManage"
    danger
    :title="$t('dms_lang.workspace.danger_title')"
  >
    <DmsFieldRow
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
        @click="rename"
      />
    </DmsFieldRow>
    <DmsFieldRow
      layout="inline"
      :label="$t('dms_lang.workspace.delete_title')"
      :description="
        $t('dms_lang.workspace.delete_help', {
          files: flat.locales.length,
          strings,
        })
      "
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
