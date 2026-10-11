<script setup lang="ts">
import { NAMESPACE_SEPARATOR } from '../../../utils/translations'

interface Props {
  rowKey: string
  /** Saved during this view and no longer matching the filter. */
  isDone: boolean
  isModules: boolean
  isOverridden: boolean
  canOverride: boolean
}

interface Emits {
  open: []
  override: []
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const split = computed(() => props.rowKey.lastIndexOf(NAMESPACE_SEPARATOR) + 1)
</script>

<template>
  <div class="flex items-start gap-1.5">
    <button
      type="button"
      class="hover:text-primary min-w-0 flex-1 text-left font-mono text-xs break-all"
      :title="$t('dms_lang.matrix.open_key')"
      @click="emit('open')"
    >
      <span class="text-dimmed">{{ props.rowKey.slice(0, split) }}</span>
      <span class="text-primary font-semibold">
        {{ props.rowKey.slice(split) }}
      </span>
    </button>
    <UIcon
      v-if="props.isDone"
      name="i-ph-check-circle-fill"
      class="text-success mt-px size-4 shrink-0"
      :aria-label="$t('dms_lang.matrix.done')"
    />
    <UButton
      icon="i-ph-arrows-out-simple"
      color="neutral"
      variant="ghost"
      size="xs"
      class="-my-1 shrink-0"
      :aria-label="
        $t('dms_lang.matrix.open_panel_named', { key: props.rowKey })
      "
      :title="$t('dms_lang.matrix.open_panel')"
      @click="emit('open')"
    />
    <UButton
      v-if="props.isModules && props.canOverride && !props.isOverridden"
      size="xs"
      color="neutral"
      variant="ghost"
      icon="i-ph-git-fork"
      class="-my-1 shrink-0 opacity-0 transition-opacity group-hover/row:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
      :aria-label="$t('dms_lang.matrix.override_named', { key: props.rowKey })"
      :title="$t('dms_lang.override.action')"
      @click="emit('override')"
    />
  </div>
  <div v-if="props.isModules && props.isOverridden">
    <button
      type="button"
      class="mt-1"
      :title="$t('dms_lang.matrix.edit_override')"
      @click="emit('override')"
    >
      <DmsStatusPill
        dot="none"
        tone="success"
        size="sm"
        icon="i-ph-check"
        :label="$t('dms_lang.override.overridden')"
      />
    </button>
  </div>
</template>
