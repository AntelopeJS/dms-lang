<script setup lang="ts">
import LanguagePicker from './LanguagePicker.vue'
import { canonicalLocale, hasSubtags, languageOf } from '../../utils/languages'

interface Emits {
  close: [added: boolean]
}

interface Props {
  workspace: string
  existing: string[]
  baseName: string
}

const LOCALE_EXISTS = 'locale_exists'

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const { t } = useI18n()
const toast = useToast()
const { addLocale, workspaces } = useI18nWorkspaces()
const { reportFailure } = useMutationToast()
const { findLanguages, fullName } = useLocaleNames()
const { refresh } = useWorkspaceFlat()

const isOpen = ref(true)
const search = ref('')
const selected = ref('')
const isSubmitting = ref(false)
/** A language picked here that another tab added meanwhile. */
const addedElsewhere = ref('')

const liveCodes = computed(
  () =>
    workspaces.value
      .find((workspace) => workspace.id === props.workspace)
      ?.locales.map((entry) => entry.code) ?? props.existing,
)
const existingCodes = computed(
  () => new Set(liveCodes.value.map((code) => canonicalLocale(code) ?? code)),
)

const options = computed(() => findLanguages(search.value))
const selectedOption = computed(
  () =>
    options.value.find(
      (option) =>
        option.code === selected.value && !existingCodes.value.has(option.code),
    ) ?? null,
)
const sameLanguage = computed(() => {
  const code = selectedOption.value?.code
  if (!code) return []
  return [...existingCodes.value].filter(
    (other) => languageOf(other) === languageOf(code),
  )
})
const isInvalidCode = computed(
  () => !options.value.length && hasSubtags(search.value),
)

watch(existingCodes, (codes) => {
  if (!selected.value || !codes.has(selected.value)) return
  addedElsewhere.value = selected.value
  selected.value = ''
})

watch(selected, (code) => {
  if (code) addedElsewhere.value = ''
})
async function submit() {
  if (!selectedOption.value || isSubmitting.value) return
  isSubmitting.value = true
  const code = selectedOption.value.code
  try {
    await addLocale(props.workspace, { code })
    close(true)
  } catch (error) {
    if (serverErrorCode(error) === LOCALE_EXISTS) {
      await closeAsAdded(code)
      return
    }
    reportFailure(error)
    isSubmitting.value = false
  }
}

/** Another tab added the language first: nothing left to do here. */
async function closeAsAdded(code: string) {
  toast.add({
    title: t('dms_lang.language_add.exists_title', {
      name: fullName(code),
      code,
    }),
    description: t('dms_lang.language_add.exists'),
    color: 'info',
    icon: 'i-ph-info',
  })
  close(false)
  await refresh()
}

function close(added: boolean) {
  isOpen.value = false
  emit('close', added)
}
</script>

<template>
  <UModal
    v-model:open="isOpen"
    :title="$t('dms_lang.language_add.title', { workspace: props.workspace })"
    :description="
      $t('dms_lang.language_add.description', { base: props.baseName })
    "
    :ui="{ content: 'sm:max-w-lg' }"
    @update:open="(open: boolean) => !open && close(false)"
  >
    <template #body>
      <div class="space-y-3">
        <LanguagePicker
          v-model="selected"
          v-model:search="search"
          :options="options"
          :taken="[...existingCodes]"
          is-open
          autofocus
          @submit="submit"
        >
          <template #empty>
            {{
              isInvalidCode
                ? $t('dms_lang.language_add.invalid_code', {
                    code: search.trim(),
                  })
                : $t('dms_lang.language_add.no_match')
            }}
          </template>
        </LanguagePicker>
        <p
          v-if="addedElsewhere"
          role="status"
          class="text-warning flex items-start gap-2 text-xs"
        >
          <UIcon name="i-ph-warning" class="mt-0.5 size-3.5 shrink-0" />
          {{
            $t('dms_lang.language_add.added_elsewhere', {
              name: fullName(addedElsewhere),
              code: addedElsewhere,
            })
          }}
        </p>
        <p
          v-else-if="selectedOption && sameLanguage.length"
          class="text-warning flex items-start gap-2 text-xs"
        >
          <UIcon name="i-ph-warning" class="mt-0.5 size-3.5 shrink-0" />
          {{
            $t('dms_lang.language_add.same_language', {
              codes: sameLanguage.join(', '),
              name: selectedOption.name,
              code: selectedOption.code,
            })
          }}
        </p>
        <p v-else class="text-muted flex items-start gap-2 text-xs">
          <UIcon name="i-ph-info" class="mt-0.5 size-3.5 shrink-0" />
          {{ $t('dms_lang.language_add.any_code') }}
        </p>
      </div>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton
          color="neutral"
          variant="outline"
          :label="$t('dms_lang.actions.cancel')"
          :disabled="isSubmitting"
          @click="close(false)"
        />
        <UButton
          icon="i-ph-plus"
          :loading="isSubmitting"
          :disabled="!selectedOption"
          :label="
            selectedOption
              ? $t('dms_lang.language_add.submit_named', {
                  name: selectedOption.name,
                  code: selectedOption.code,
                })
              : $t('dms_lang.language_add.submit')
          "
          @click="submit"
        />
      </div>
    </template>
  </UModal>
</template>
