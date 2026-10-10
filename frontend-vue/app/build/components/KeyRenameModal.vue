<script setup lang="ts">
import FormFieldRow from './form/FormFieldRow.vue'
import FormRows from './form/FormRows.vue'

interface Props {
  workspace: string
  path: string
  languageCount: number
  existingKeys: string[]
}

const KEY_PATH_RE = /^[\w-]+(\.[\w-]+)*$/

const props = defineProps<Props>()
const emit = defineEmits<{ close: [newPath: string | null] }>()

const { t } = useI18n()
const { renameKey } = useI18nWorkspaces()
const { tryMutate } = useMutationToast()

const isOpen = ref(true)
const newPath = ref(props.path)
const isSubmitting = ref(false)

const trimmed = computed(() => newPath.value.trim())
const error = computed(() => {
  if (trimmed.value === props.path) return ''
  if (!KEY_PATH_RE.test(trimmed.value))
    return t('dms_lang.key_add.path_invalid')
  if (props.existingKeys.includes(trimmed.value))
    return t('dms_lang.key_add.path_taken')
  return ''
})
const isValid = computed(() => trimmed.value !== props.path && !error.value)

function close(value: string | null) {
  isOpen.value = false
  emit('close', value)
}

async function submit() {
  if (!isValid.value || isSubmitting.value) return
  isSubmitting.value = true
  const target = trimmed.value
  const ok = await tryMutate(() =>
    renameKey(props.workspace, props.path, target),
  )
  isSubmitting.value = false
  if (ok) close(target)
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
