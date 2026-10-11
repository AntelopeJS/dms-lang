<script setup lang="ts">
/**
 * What a workspace is for: its free description and its type, as rows of a
 * hand-built form (`FormRows`).
 */
import type { WorkspaceType } from '../../../types/lang'
import FormFieldRow from './FormFieldRow.vue'

const DESCRIPTION_ROWS = 2

const description = defineModel<string>('description', { default: '' })
const type = defineModel<WorkspaceType | undefined>('type')

const { typeItems, typeOf, descriptionMax } = useWorkspaceTypes()
</script>

<template>
  <FormFieldRow
    :label="$t('dms_lang.workspace_details.description_label')"
    :help="$t('dms_lang.workspace_details.description_help')"
  >
    <template #default="{ id }">
      <DmsTextarea
        :id="id"
        v-model="description"
        :rows="DESCRIPTION_ROWS"
        :maxlength="descriptionMax"
        autoresize
        class="w-full"
        :placeholder="$t('dms_lang.workspace_details.description_placeholder')"
      />
    </template>
  </FormFieldRow>
  <FormFieldRow :label="$t('dms_lang.workspace_details.type_label')">
    <template #default="{ id }">
      <DmsSegmentedSelect
        :id="id"
        :model-value="type"
        :items="typeItems"
        @update:model-value="(value: unknown) => (type = typeOf(value))"
      />
    </template>
  </FormFieldRow>
</template>
