<script setup lang="ts">
import {
  isValidKeyPath,
  keyPathConflict,
  type KeyPathConflict,
} from '../../utils/translations'
import FormFieldRow from './form/FormFieldRow.vue'
import FormRows from './form/FormRows.vue'

interface Props {
  workspace: string
  path: string
  languageCount: number
  existingKeys: string[]
  /** Project files only: the keys the installed modules provide. */
  moduleKeys?: string[]
}

const CONFLICT_LABELS: Record<KeyPathConflict['kind'], string> = {
  exists: 'dms_lang.key_add.path_taken',
  namespace: 'dms_lang.key_add.path_namespace_conflict',
  leafParent: 'dms_lang.key_add.path_parent_conflict',
}

const MODULE_CONFLICT_LABELS: Record<KeyPathConflict['kind'], string> = {
  exists: 'dms_lang.key_rename.module_key',
  namespace: 'dms_lang.key_add.module_namespace',
  leafParent: 'dms_lang.key_add.module_parent',
}

interface Emits {
  close: [newPath: string | null]
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const { t } = useI18n()
const { errorMessage } = useMutationToast()
const { renameKey } = useI18nWorkspaces()
const { applyRow } = useWorkspaceFlat()

const isOpen = ref(true)
const newPath = ref(props.path)
const isSubmitting = ref(false)
const submitError = ref('')

const trimmed = computed(() => newPath.value.trim())
const otherKeys = computed(() =>
  props.existingKeys.filter((key) => key !== props.path),
)

function conflictText(
  found: KeyPathConflict | null,
  labels: Record<KeyPathConflict['kind'], string>,
): string {
  if (!found) return ''
  return t(
    labels[found.kind],
    {
      path: trimmed.value,
      parent: found.keys[0],
      example: found.keys[0],
      count: found.keys.length,
    },
    found.keys.length,
  )
}

const error = computed(() => {
  if (trimmed.value === props.path) return ''
  if (!isValidKeyPath(trimmed.value)) return t('dms_lang.key_add.path_invalid')
  return (
    conflictText(
      keyPathConflict(trimmed.value, otherKeys.value),
      CONFLICT_LABELS,
    ) ||
    conflictText(
      keyPathConflict(trimmed.value, props.moduleKeys ?? []),
      MODULE_CONFLICT_LABELS,
    ) ||
    submitError.value
  )
})
const isValid = computed(() => trimmed.value !== props.path && !error.value)

watch(trimmed, () => (submitError.value = ''))

function close(value: string | null) {
  isOpen.value = false
  emit('close', value)
}

async function submit() {
  if (!isValid.value || isSubmitting.value) return
  isSubmitting.value = true
  const target = trimmed.value
  try {
    const response = await renameKey(props.workspace, props.path, target)
    applyRow(props.workspace, props.path, response)
    close(target)
  } catch (failure) {
    submitError.value = errorMessage(failure)
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="isOpen"
    :title="$t('dms_lang.key_rename.title')"
    :description="$t('dms_lang.key_rename.description', props.languageCount)"
    :ui="{ content: 'sm:max-w-lg' }"
    @update:open="(open: boolean) => !open && close(null)"
  >
    <template #body>
      <form novalidate @submit.prevent="submit">
        <FormRows has-required>
          <FormFieldRow :label="$t('dms_lang.key_rename.current')">
            <template #default="{ id }">
              <DmsInputText
                :id="id"
                :model-value="props.path"
                disabled
                class="w-full"
                :ui="{ base: 'font-mono' }"
              />
            </template>
          </FormFieldRow>
          <FormFieldRow
            :label="$t('dms_lang.key_rename.new')"
            :help="
              error
                ? undefined
                : $t('dms_lang.key_rename.help', { path: props.path })
            "
            :error="error || null"
            required
          >
            <template #default="{ id }">
              <DmsInputText
                :id="id"
                v-model="newPath"
                autofocus
                class="w-full"
                :ui="{ base: 'font-mono' }"
              />
            </template>
          </FormFieldRow>
        </FormRows>
      </form>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton
          color="neutral"
          variant="outline"
          :label="$t('dms_lang.actions.cancel')"
          @click="close(null)"
        />
        <UButton
          :loading="isSubmitting"
          :disabled="!isValid"
          :label="$t('dms_lang.key_rename.submit')"
          @click="submit"
        />
      </div>
    </template>
  </UModal>
</template>
