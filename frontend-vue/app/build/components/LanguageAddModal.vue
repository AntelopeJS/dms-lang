<script setup lang="ts">
import LocaleTile from './LocaleTile.vue'
import {
  canonicalLocale,
  languageOf,
  typedLocaleCode,
  type LanguageOption,
} from '../../utils/languages'

interface Props {
  workspace: string
  existing: string[]
  baseName: string
}

const STEP_KEYS: Record<string, number> = { ArrowDown: 1, ArrowUp: -1 }
const LOCALE_EXISTS = 'locale_exists'

const props = defineProps<Props>()
const emit = defineEmits<{ close: [added: boolean] }>()

const { t } = useI18n()
const toast = useToast()
const { addLocale, workspaces } = useI18nWorkspaces()
const { reportFailure } = useMutationToast()
const { findLanguages, fullName } = useLocaleNames()
const { reload } = useWorkspaceFlat()

const isOpen = ref(true)
const search = ref('')
const selected = ref('')
const isSubmitting = ref(false)
/** A language picked here that another tab added meanwhile. */
const addedElsewhere = ref('')

// The workspace list follows the other tabs (realtime, tab focus): a
// language added there stops being offered here.
const liveCodes = computed(
  () =>
    workspaces.value
      .find((workspace) => workspace.id === props.workspace)
      ?.locales.map((entry) => entry.code) ?? props.existing,
)
const existingCodes = computed(
  () => new Set(liveCodes.value.map((code) => canonicalLocale(code) ?? code)),
)

function isAdded(option: LanguageOption): boolean {
  return existingCodes.value.has(option.code)
}

const options = computed(() => findLanguages(search.value))
const suggestions = computed(() => options.value.filter((o) => !isAdded(o)))
const alreadyAdded = computed(() => options.value.filter(isAdded))
const selectedOption = computed(
  () =>
    suggestions.value.find((option) => option.code === selected.value) ?? null,
)
const sameLanguage = computed(() => {
  const code = selectedOption.value?.code
  if (!code) return []
  return [...existingCodes.value].filter(
    (other) => languageOf(other) === languageOf(code),
  )
})
const isInvalidCode = computed(
  () => !options.value.length && /[-_]/.test(search.value),
)

watch(search, () => {
  const exact = typedLocaleCode(search.value)
  const match = suggestions.value.find((option) => option.code === exact)
  selected.value = match && !match.isUnknown ? match.code : ''
})

watch(existingCodes, (codes) => {
  if (!selected.value || !codes.has(selected.value)) return
  addedElsewhere.value = selected.value
  selected.value = ''
})

watch(selected, (code) => {
  if (code) addedElsewhere.value = ''
})

function step(event: KeyboardEvent) {
  const delta = STEP_KEYS[event.key]
  const list = suggestions.value
  if (!delta || !list.length) return
  event.preventDefault()
  const index = list.findIndex((option) => option.code === selected.value)
  const next = index < 0 ? (delta > 0 ? 0 : list.length - 1) : index + delta
  selected.value = list[(next + list.length) % list.length]?.code ?? ''
  document
    .getElementById(optionId(selected.value))
    ?.scrollIntoView({ block: 'nearest' })
}

function optionId(code: string): string {
  return `language-add-${code}`
}

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
  await reload()
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
        <DmsInputText
          v-model="search"
          icon="i-ph-magnifying-glass"
          autofocus
          class="w-full"
          role="combobox"
          aria-autocomplete="list"
          aria-controls="language-add-options"
          :aria-activedescendant="selected ? optionId(selected) : undefined"
          :placeholder="$t('dms_lang.language_add.search')"
          @keydown.enter.prevent="submit"
          @keydown="step"
        />
        <div
          id="language-add-options"
          role="listbox"
          class="max-h-80 space-y-0.5 overflow-y-auto"
        >
          <DmsEyebrow
            v-if="suggestions.length"
            :label="$t('dms_lang.language_add.suggested', suggestions.length)"
            size="xs"
            class="px-2 pt-1 pb-1.5"
          />
          <button
            v-for="option in suggestions"
            :id="optionId(option.code)"
            :key="option.code"
            type="button"
            role="option"
            :aria-selected="option.code === selected"
            class="flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left transition-colors"
            :class="
              option.code === selected
                ? 'bg-primary/10 text-highlighted'
                : 'hover:bg-elevated/60'
            "
            @click="selected = option.code"
            @dblclick="submit"
          >
            <LocaleTile :code="option.code" />
            <span class="min-w-0 flex-1">
              <span class="text-highlighted block truncate text-sm">
                {{ option.name }}
              </span>
              <span class="text-dimmed block truncate text-xs">
                {{
                  option.isUnknown
                    ? $t('dms_lang.language_add.unknown')
                    : option.localName
                }}
              </span>
            </span>
            <span class="text-dimmed font-mono text-xs">{{ option.code }}</span>
            <UIcon
              v-if="option.code === selected"
              name="i-ph-check"
              class="text-primary size-4"
            />
          </button>
          <template v-if="alreadyAdded.length">
            <DmsEyebrow
              :label="$t('dms_lang.language_add.already_added')"
              size="xs"
              class="px-2 pt-3 pb-1.5"
            />
            <div
              v-for="option in alreadyAdded"
              :key="option.code"
              class="flex items-center gap-3 px-2 py-1.5 opacity-60"
            >
              <LocaleTile :code="option.code" />
              <span class="text-highlighted flex-1 truncate text-sm">
                {{ option.name }}
              </span>
              <span class="text-dimmed font-mono text-xs">
                {{ option.code }}
              </span>
              <DmsStatusPill
                dot="none"
                tone="neutral"
                size="sm"
                :label="$t('dms_lang.language_add.added')"
              />
            </div>
          </template>
          <p
            v-if="!options.length"
            class="text-muted px-2 py-6 text-center text-sm"
          >
            {{
              isInvalidCode
                ? $t('dms_lang.language_add.invalid_code', {
                    code: search.trim(),
                  })
                : $t('dms_lang.language_add.no_match')
            }}
          </p>
        </div>
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
