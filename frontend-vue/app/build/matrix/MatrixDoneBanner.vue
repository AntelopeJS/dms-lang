<script setup lang="ts">
import UButton from '@nuxt/ui/components/Button.vue'

/** The banner of the matrix over the rows finished since it opened: how many, and hiding them. */
defineProps<{
  doneCount: number
  formatCount: (value: number) => string
  hideDone: () => void
}>()
</script>

<template>
  <div
    class="border-default bg-success/5 flex flex-wrap items-center gap-2 border-b px-4 py-2 text-sm"
    role="status"
  >
    <UIcon name="i-ph-check-circle" class="text-success size-4" />
    <span class="text-default">
      {{
        $t(
          'dms_lang.matrix.done_banner',
          { count: formatCount(doneCount) },
          doneCount,
        )
      }}
    </span>
    <UButton
      size="xs"
      color="neutral"
      variant="outline"
      class="ml-auto"
      :label="$t('dms_lang.matrix.hide_done')"
      @click="hideDone"
    />
  </div>
</template>
