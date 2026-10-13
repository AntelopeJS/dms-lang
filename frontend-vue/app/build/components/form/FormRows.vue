<script setup lang="ts">
/**
 * The rows of a hand-built form (`FormFieldRow`), hairlines between them,
 * and the legend of their required mark, worded and drawn as a DMS form
 * ends its rows.
 */
interface FormRowsProps {
  /** Whether a row carries the required mark the legend explains. */
  hasRequired?: boolean
}

const props = withDefaults(defineProps<FormRowsProps>(), {
  hasRequired: false,
})
</script>

<template>
  <div class="flex flex-col">
    <slot />
    <p v-if="props.hasRequired" class="text-dimmed pb-2 text-xs">
      <span class="text-error" aria-hidden="true">*</span>
      {{ $t('dms.form.required_legend') }}
    </p>
  </div>
</template>
