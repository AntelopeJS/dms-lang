<script setup lang="ts">
interface Props {
  namespace: string
  keys: number
  missing: number
  collapsed: boolean
}

interface Emits {
  toggle: []
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const { formatCount } = useLangFormat()
</script>

<template>
  <button
    type="button"
    class="flex items-center gap-2"
    :aria-expanded="!props.collapsed"
    @click="emit('toggle')"
  >
    <UIcon
      name="i-ph-caret-down"
      class="text-dimmed size-3.5 transition-transform"
      :class="props.collapsed ? '-rotate-90' : undefined"
    />
    <span class="text-highlighted font-mono text-xs font-semibold uppercase">
      {{ props.namespace }}
    </span>
    <span class="text-dimmed font-mono text-[10.5px]">
      {{
        $t(
          'dms_lang.matrix.group_keys',
          { count: formatCount(props.keys) },
          props.keys,
        )
      }}
    </span>
    <DmsStatusPill
      v-if="props.missing"
      dot="none"
      tone="warning"
      size="sm"
      :label="
        $t(
          'dms_lang.matrix.group_missing',
          { count: formatCount(props.missing) },
          props.missing,
        )
      "
    />
  </button>
</template>
