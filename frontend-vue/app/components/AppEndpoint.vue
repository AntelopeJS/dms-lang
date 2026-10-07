<script setup lang="ts">
const { current, isAdded } = useWorkspaceContext()
const links = useLangLinks()

const url = computed(() =>
  current.value ? links.publicLocaleUrl(current.value.id) : '',
)
</script>

<template>
  <DmsCard
    v-if="isAdded && current"
    :padded="false"
    :title="$t('dms_lang.endpoint.title')"
  >
    <template #actions>
      <UButton
        size="xs"
        color="neutral"
        variant="ghost"
        trailing-icon="i-ph-arrow-right"
        :label="$t('dms_lang.endpoint.settings')"
        :to="links.workspaceSettings(current.id)"
      />
    </template>
    <div class="border-default flex items-center gap-2.5 border-b px-4 py-3">
      <DmsStatusPill tone="success" size="sm" label="GET" dot="none" />
      <code
        class="text-default min-w-0 flex-1 truncate font-mono text-xs"
        :title="url"
      >
        {{ url }}
      </code>
      <DmsCopyButton :value="url" />
    </div>
    <p class="text-muted flex items-start gap-2 px-4 py-3 text-xs">
      <UIcon name="i-ph-info" class="mt-0.5 size-3.5 shrink-0" />
      {{ $t('dms_lang.endpoint.note') }}
    </p>
  </DmsCard>
  <DmsCard
    v-else-if="current"
    :padded="false"
    :title="$t('dms_lang.endpoint.source_title')"
  >
    <p class="text-muted flex items-start gap-2 px-4 py-3 text-xs">
      <UIcon
        :name="current.kind === 'modules' ? 'i-ph-puzzle-piece' : 'i-ph-folder'"
        class="mt-0.5 size-3.5 shrink-0"
      />
      {{ $t(`dms_lang.workspace_kinds.${current.kind}.source`) }}
    </p>
  </DmsCard>
</template>
