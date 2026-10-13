<script setup lang="ts">
import type { SelectMenuItem } from '@nuxt/ui'
import { typedLocaleCode, type LanguageOption } from '../../utils/languages'
import LocaleTile from './LocaleTile.vue'

interface Props {
  /** The languages offered for the search, best first. */
  options: LanguageOption[]
  /** Codes offered but not to pick again: listed apart, disabled. */
  taken?: string[]
  /** The id the field's label points to. */
  id?: string
  placeholder?: string
  autofocus?: boolean
  /** A search field over a list always open, instead of a menu. */
  isOpen?: boolean
}

interface Emits {
  /** Enter or a double click on a language of the open list. */
  submit: []
}

interface Slots {
  /** What the list says when the search finds nothing. */
  empty?: () => unknown
}

const STEP_KEYS: Record<string, number> = { ArrowDown: 1, ArrowUp: -1 }
const LISTBOX_ID = 'language-picker-options'

const props = withDefaults(defineProps<Props>(), {
  taken: () => [],
  id: undefined,
  placeholder: undefined,
  autofocus: false,
  isOpen: false,
})
const emit = defineEmits<Emits>()
const code = defineModel<string>({ default: '' })
const search = defineModel<string>('search', { default: '' })
defineSlots<Slots>()

const { t } = useI18n()
const { fullName } = useLocaleNames()

const takenCodes = computed(() => new Set(props.taken))
const free = computed(() =>
  props.options.filter((option) => !takenCodes.value.has(option.code)),
)
const added = computed(() =>
  props.options.filter((option) => takenCodes.value.has(option.code)),
)

function detailOf(option: LanguageOption): string {
  return option.isUnknown
    ? t('dms_lang.language_add.unknown')
    : option.localName
}

function itemOf(option: LanguageOption, isTaken: boolean): SelectMenuItem {
  return {
    label: option.name,
    value: option.code,
    description: detailOf(option),
    disabled: isTaken,
  }
}

/** The languages to pick, then the ones already there, under their own label. */
const items = computed<SelectMenuItem[][]>(() => {
  const groups = [free.value.map((option) => itemOf(option, false))]
  if (!added.value.length) return groups
  const label = {
    type: 'label' as const,
    label: t('dms_lang.language_add.already_added'),
  }
  return [...groups, [label, ...added.value.map((o) => itemOf(o, true))]]
})

function optionId(value: string): string {
  return `${LISTBOX_ID}-${value}`
}

/** Typing a code the list offers picks it. */
watch(search, () => {
  if (!props.isOpen) return
  const exact = typedLocaleCode(search.value)
  const match = free.value.find((option) => option.code === exact)
  code.value = match && !match.isUnknown ? match.code : ''
})

function step(event: KeyboardEvent) {
  const delta = STEP_KEYS[event.key]
  const list = free.value
  if (!delta || !list.length) return
  event.preventDefault()
  const index = list.findIndex((option) => option.code === code.value)
  const start = delta > 0 ? 0 : list.length - 1
  const next = index < 0 ? start : index + delta
  code.value = list[(next + list.length) % list.length]?.code ?? ''
  document
    .getElementById(optionId(code.value))
    ?.scrollIntoView({ block: 'nearest' })
}
</script>

<template>
  <div v-if="props.isOpen" class="space-y-3">
    <DmsInputText
      :id="props.id"
      v-model="search"
      icon="i-ph-magnifying-glass"
      :autofocus="props.autofocus"
      class="w-full"
      role="combobox"
      aria-autocomplete="list"
      :aria-expanded="true"
      :aria-controls="LISTBOX_ID"
      :aria-activedescendant="code ? optionId(code) : undefined"
      :placeholder="$t('dms_lang.language_add.search')"
      @keydown.enter.prevent="emit('submit')"
      @keydown="step"
    />
    <div
      :id="LISTBOX_ID"
      role="listbox"
      class="max-h-80 space-y-0.5 overflow-y-auto"
    >
      <DmsEyebrow
        v-if="free.length"
        :label="$t('dms_lang.language_add.suggested', free.length)"
        size="xs"
        class="px-2 pt-1 pb-1.5"
      />
      <button
        v-for="option in free"
        :id="optionId(option.code)"
        :key="option.code"
        type="button"
        role="option"
        :aria-selected="option.code === code"
        class="flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left transition-colors"
        :class="
          option.code === code
            ? 'bg-primary/10 text-highlighted'
            : 'hover:bg-elevated/60'
        "
        @click="code = option.code"
        @dblclick="emit('submit')"
      >
        <LocaleTile :code="option.code" />
        <span class="min-w-0 flex-1">
          <span class="text-highlighted block truncate text-sm">
            {{ option.name }}
          </span>
          <span class="text-dimmed block truncate text-xs">
            {{ detailOf(option) }}
          </span>
        </span>
        <span class="text-dimmed font-mono text-xs">{{ option.code }}</span>
        <UIcon
          v-if="option.code === code"
          name="i-ph-check"
          class="text-primary size-4"
        />
      </button>
      <template v-if="added.length">
        <DmsEyebrow
          :label="$t('dms_lang.language_add.already_added')"
          size="xs"
          class="px-2 pt-3 pb-1.5"
        />
        <div
          v-for="option in added"
          :key="option.code"
          role="option"
          aria-disabled="true"
          :aria-selected="false"
          class="flex items-center gap-3 px-2 py-1.5 opacity-60"
        >
          <LocaleTile :code="option.code" />
          <span class="text-highlighted flex-1 truncate text-sm">
            {{ option.name }}
          </span>
          <span class="text-dimmed font-mono text-xs">{{ option.code }}</span>
          <DmsStatusPill
            dot="none"
            tone="neutral"
            size="sm"
            :label="$t('dms_lang.language_add.added')"
          />
        </div>
      </template>
      <p
        v-if="!props.options.length"
        class="text-muted px-2 py-6 text-center text-sm"
      >
        <slot name="empty">{{ $t('dms_lang.language_add.no_match') }}</slot>
      </p>
    </div>
  </div>
  <USelectMenu
    v-else
    :id="props.id"
    v-model="code"
    v-model:search-term="search"
    :items="items"
    value-key="value"
    ignore-filter
    :autofocus="props.autofocus"
    :search-input="{ placeholder: $t('dms_lang.language_add.search') }"
    class="w-full"
    :ui="{ content: 'min-w-80' }"
  >
    <template #leading>
      <LocaleTile v-if="code" :code="code" size="sm" />
    </template>
    <template #default>
      <span v-if="code" class="flex min-w-0 items-center gap-1.5">
        <span class="text-highlighted truncate">{{ fullName(code) }}</span>
        <span class="text-dimmed font-mono text-xs">· {{ code }}</span>
      </span>
      <span v-else class="text-dimmed truncate">{{ props.placeholder }}</span>
    </template>
    <template #item-trailing="{ item }">
      <span class="text-dimmed font-mono text-xs">{{ item.value }}</span>
    </template>
    <template #empty>
      <slot name="empty">{{ $t('dms_lang.language_add.no_match') }}</slot>
    </template>
  </USelectMenu>
</template>
