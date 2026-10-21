<script setup lang="ts">
import PlaceholderText from './PlaceholderText.vue'

// Under the key in the DMS row header of the key panel: what the key
// misses, its issues and its base text's placeholders.
interface Props {
  missingCount: number
  issueCount: number
  /** `{price} {count}`; empty without any. */
  placeholders: string
}

defineProps<Props>()
</script>

<template>
  <div
    v-if="missingCount || issueCount || placeholders"
    class="flex flex-wrap items-center gap-1.5"
  >
    <DmsStatusPill
      v-if="missingCount"
      dot="none"
      tone="warning"
      size="sm"
      :label="$t('dms_lang.drawer.missing', missingCount)"
    />
    <DmsStatusPill
      v-if="issueCount"
      dot="none"
      tone="error"
      size="sm"
      icon="i-ph-warning"
      :label="$t('dms_lang.drawer.issues', issueCount)"
    />
    <span
      v-if="placeholders"
      class="text-dimmed inline-flex items-center gap-1.5 text-xs"
    >
      <UIcon name="i-ph-brackets-curly" class="size-3.5" />
      {{ $t('dms_lang.drawer.placeholders') }}
      <PlaceholderText :text="placeholders" />
    </span>
  </div>
</template>
