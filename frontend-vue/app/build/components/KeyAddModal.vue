<script setup lang="ts">
import { namespaceOf } from '../../utils/translations'
import FormFieldRow from './form/FormFieldRow.vue'
import FormRows from './form/FormRows.vue'

interface Props {
  workspace: string
  baseLocale: string
  baseName: string
  existingKeys: string[]
}

const KEY_PATH_RE = /^[\w-]+(\.[\w-]+)*$/

const props = defineProps<Props>()
const emit = defineEmits<{ close: [added: string[]] }>()

const { t } = useI18n()
const toast = useToast()
const { upsertKey } = useI18nWorkspaces()
const { tryMutate } = useMutationToast()

const isOpen = ref(true)
const path = ref('')
const baseText = ref('')
const addAnother = ref(false)
const isSubmitting = ref(false)
const added = ref<string[]>([])
const form = useTemplateRef<HTMLFormElement>('form')

const trimmedPath = computed(() => path.value.trim())
const isTaken = computed(
  () =>
    props.existingKeys.includes(trimmedPath.value) ||
    added.value.includes(trimmedPath.value),
)
const isValid = computed(
  () => KEY_PATH_RE.test(trimmedPath.value) && !isTaken.value,
)

const pathHelp = computed(() => {
  if (!trimmedPath.value) return t('dms_lang.key_add.path_help')
  if (isTaken.value) return t('dms_lang.key_add.path_taken')
  if (!KEY_PATH_RE.test(trimmedPath.value))
    return t('dms_lang.key_add.path_invalid')
  const namespace = namespaceOf(trimmedPath.value)
  const siblings = props.existingKeys.filter(
    (key) => namespaceOf(key) === namespace,
  ).length
  return t('dms_lang.key_add.path_namespace', { namespace, count: siblings })
})
const hasPathError = computed(
  () => Boolean(trimmedPath.value) && !isValid.value,
)

function close() {
  isOpen.value = false
  emit('close', added.value)
}

function resetForNext() {
  path.value = ''
  baseText.value = ''
  nextTick(() => form.value?.querySelector('input')?.focus())
}

async function submit() {
  if (!isValid.value || isSubmitting.value) return
  isSubmitting.value = true
  const key = trimmedPath.value
  const values = { [props.baseLocale]: baseText.value }
  const ok = await tryMutate(() =>
    upsertKey(props.workspace, key, values, props.baseLocale),
  )
  isSubmitting.value = false
  if (!ok) return
  added.value = [...added.value, key]
  toast.add({
    title: t('dms_lang.key_add.added', { key }),
    color: 'success',
    icon: 'i-ph-check-circle',
  })
  if (addAnother.value) resetForNext()
  else close()
}
</script>

<template>
  <UModal
    v-model:open="isOpen"
    :title="$t('dms_lang.key_add.title')"
    :description="
      $t('dms_lang.key_add.description', { workspace: props.workspace })
    "
    :ui="{ content: 'sm:max-w-lg' }"
    @update:open="(open: boolean) => !open && close()"
  >
    <template #body>
      <form ref="form" novalidate @submit.prevent="submit">
        <FormRows has-required>
          <FormFieldRow
            :label="$t('dms_lang.key_add.path')"
            :help="hasPathError ? undefined : pathHelp"
            :error="hasPathError ? pathHelp : null"
            required
          >
            <template #default="{ id }">
              <DmsInputText
                :id="id"
                v-model="path"
                autofocus
                class="w-full"
                :ui="{ base: 'font-mono' }"
                placeholder="checkout.coupon.invalid"
              />
            </template>
          </FormFieldRow>
          <FormFieldRow :label="props.baseName">
            <template #label-extra>
              <DmsStatusPill
                dot="none"
                tone="neutral"
                size="sm"
                :label="$t('dms_lang.common.base')"
              />
            </template>
            <template #default="{ id }">
              <DmsTextarea
                :id="id"
                v-model="baseText"
                :rows="2"
                autoresize
                class="w-full"
                @keydown.meta.enter.prevent="submit"
                @keydown.ctrl.enter.prevent="submit"
              />
            </template>
          </FormFieldRow>
        </FormRows>
      </form>
    </template>
    <template #footer>
      <div class="flex w-full items-center gap-2">
        <DmsCheckbox
          v-model="addAnother"
          :label="$t('dms_lang.key_add.add_another')"
        />
        <div class="flex-1" />
        <UButton
          color="neutral"
          variant="outline"
          :label="$t('dms_lang.actions.cancel')"
          @click="close()"
        />
        <UButton
          icon="i-ph-plus"
          :loading="isSubmitting"
          :disabled="!isValid"
          :label="$t('dms_lang.key_add.submit')"
          @click="submit"
        />
      </div>
    </template>
  </UModal>
</template>
