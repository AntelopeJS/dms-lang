<script setup lang="ts">
import LocaleTile from './LocaleTile.vue'
import {
  SUGGESTED_LANGUAGE_CODES,
  canonicalLocale,
} from '../../utils/languages'

interface Props {
  workspace: string
  existing: string[]
  baseName: string
}

interface LanguageOption {
  code: string
  name: string
  localName: string
  isAdded: boolean
}

const MAX_RESULTS = 8

const props = defineProps<Props>()
const emit = defineEmits<{ close: [added: boolean] }>()

const { addLocale } = useI18nWorkspaces()
const { tryMutate } = useMutationToast()
const { nativeName, localName, isKnownLanguage } = useLocaleNames()

const isOpen = ref(true)
const search = ref('')
const selected = ref('')
const isSubmitting = ref(false)

function toOption(code: string): LanguageOption {
  return {
    code,
    name: nativeName(code),
    localName: localName(code),
    isAdded: props.existing.includes(code),
  }
}

function matches(option: LanguageOption, needle: string): boolean {
  return [option.code, option.name, option.localName].some((text) =>
    text.toLowerCase().includes(needle),
  )
}

const typedCode = computed(() => {
  const code = canonicalLocale(search.value)
  if (!code || !isKnownLanguage(code)) return null
  return SUGGESTED_LANGUAGE_CODES.includes(code) ? null : code
})

const options = computed(() => {
  const needle = search.value.trim().toLowerCase()
  const all = SUGGESTED_LANGUAGE_CODES.map(toOption).filter(
    (option) => !needle || matches(option, needle),
  )
  const typed = typedCode.value ? [toOption(typedCode.value)] : []
  return [...typed, ...all].slice(0, MAX_RESULTS)
})

const suggestions = computed(() => options.value.filter((o) => !o.isAdded))
const alreadyAdded = computed(() => options.value.filter((o) => o.isAdded))
const selectedOption = computed(() =>
  selected.value ? toOption(selected.value) : null,
)

watch(
  suggestions,
  (list) => {
    if (!list.some((option) => option.code === selected.value)) {
      selected.value = list[0]?.code ?? ''
    }
  },
  { immediate: true },
)

async function submit() {
  if (!selected.value || isSubmitting.value) return
  isSubmitting.value = true
  const code = selected.value
  const ok = await tryMutate(() => addLocale(props.workspace, { code }))
  isSubmitting.value = false
  if (ok) close(true)
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
        <UInput
          v-model="search"
          icon="i-ph-magnifying-glass"
          autofocus
          class="w-full"
          :placeholder="$t('dms_lang.language_add.search')"
          @keydown.enter.prevent="submit"
        />
        <div class="max-h-80 space-y-0.5 overflow-y-auto">
          <DmsEyebrow
            v-if="suggestions.length"
            :label="$t('dms_lang.language_add.suggested', suggestions.length)"
            size="xs"
            class="px-2 pb-1.5 pt-1"
          />
          <button
            v-for="option in suggestions"
            :key="option.code"
            type="button"
            class="flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left transition-colors"
            :class="
              option.code === selected
                ? 'bg-primary/10 text-highlighted'
                : 'hover:bg-elevated/60'
            "
            @click="selected = option.code"
          >
            <LocaleTile :code="option.code" />
            <span class="min-w-0 flex-1">
              <span class="text-highlighted block truncate text-sm">
                {{ option.name }}
              </span>
              <span class="text-dimmed block truncate text-xs">
                {{ option.localName }}
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
              class="px-2 pb-1.5 pt-3"
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
            {{ $t('dms_lang.language_add.no_match') }}
          </p>
        </div>
        <p class="text-muted flex items-start gap-2 text-xs">
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
                })
              : $t('dms_lang.language_add.submit')
          "
          @click="submit"
        />
      </div>
    </template>
  </UModal>
</template>
