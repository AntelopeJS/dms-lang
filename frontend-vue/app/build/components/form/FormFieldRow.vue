<script setup lang="ts">
/**
 * One field of a hand-built form, drawn as a DMS form draws its rows
 * (`FormEntries` / `FormFieldControl`): a `DmsFieldRow` holding the label,
 * its description and the required mark, and a label-less `UFormField`
 * holding the control, its help line and its error, which also marks the
 * control invalid. The error line carries the warning icon of the DMS
 * form's (`FormErrorText`).
 */
interface FormFieldRowProps {
  label?: string
  /** Under the label. */
  description?: string
  /** Under the control, replaced by the error while there is one. */
  help?: string
  /** Already translated; marks the control invalid. */
  error?: string | null
  required?: boolean
}

interface FormFieldRowControl {
  /** Id of the control, the one the label points to. */
  id: string
}

interface FormFieldRowSlots {
  /** The control; bind `id` onto it. */
  default?: (control: FormFieldRowControl) => unknown
  /** Inline after the label (a badge). */
  'label-extra'?: () => unknown
}

const props = withDefaults(defineProps<FormFieldRowProps>(), {
  label: undefined,
  description: undefined,
  help: undefined,
  error: null,
  required: false,
})
const slots = defineSlots<FormFieldRowSlots>()

const controlId = useId()
</script>

<template>
  <DmsFieldRow
    layout="form"
    :inset="false"
    spacing="row"
    :label="props.label"
    :description="props.description"
    :label-for="controlId"
    :required="props.required"
  >
    <template v-if="slots['label-extra']" #label-extra>
      <slot name="label-extra" />
    </template>
    <UFormField
      :help="props.help"
      :error="props.error ?? undefined"
      class="min-w-0"
    >
      <slot :id="controlId" />
      <template v-if="props.error" #error="{ error: message }">
        <UIcon name="i-ph-warning-circle" class="size-3.5 shrink-0" />
        {{ message }}
      </template>
    </UFormField>
  </DmsFieldRow>
</template>
