<script setup lang="ts">
import type { ShortcutKeys } from '../../utils/shortcuts'

interface Props {
  /** The combination, as `defineShortcuts` names its keys. */
  keys: ShortcutKeys
}

const props = defineProps<Props>()
const { keyLabel } = useKeyboardPlatform()
</script>

<template>
  <span class="inline-flex items-center gap-0.5">
    <UKbd
      v-for="key in props.keys"
      :key="key"
      size="sm"
      :value="keyLabel(key)"
    />
  </span>
</template>
