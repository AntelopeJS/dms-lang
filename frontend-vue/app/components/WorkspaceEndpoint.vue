<script setup lang="ts">
import { useDmsRuntimeConfig } from '#dms/frontend-module'

const { selectedWorkspace } = useI18nWorkspaces()
const { isAdded } = useWorkspaceContext()

const baseUrl = useDmsRuntimeConfig().public.dms.baseURL

const publicUrl = computed(() =>
  isAdded.value
    ? `${baseUrl}/i18n/${selectedWorkspace.value}/{locale}.json`
    : null,
)
</script>

<template>
  <DmsCard v-if="publicUrl" :padded="false">
    <div class="flex flex-wrap items-center gap-3 px-4 py-3">
      <UBadge color="success" variant="solid" size="sm">GET</UBadge>
      <code class="text-default break-all font-mono text-xs">
        {{ publicUrl }}
      </code>
      <DmsCopyButton :value="publicUrl" />
      <span class="text-muted text-xs">
        {{ $t('dms_lang.translation.ws_http_notice_hint') }}
      </span>
    </div>
  </DmsCard>
</template>
