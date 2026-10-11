<script setup lang="ts">
import type { SelectMenuItem } from '@nuxt/ui'
import type { LanguageOption } from '../../utils/languages'
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
}

interface Slots {
  /** What the list says when the search finds nothing. */
  empty?: () => unknown
}

const props = withDefaults(defineProps<Props>(), {
  taken: () => [],
  id: undefined,
  placeholder: undefined,
  autofocus: false,
})
const code = defineModel<string>({ default: '' })
const search = defineModel<string>('search', { default: '' })
defineSlots<Slots>()

const { t } = useI18n()
const { fullName } = useLocaleNames()

function itemOf(option: LanguageOption, isTaken: boolean): SelectMenuItem {
  return {
    label: option.name,
    value: option.code,
    description: option.isUnknown
      ? t('dms_lang.language_add.unknown')
      : option.localName,
    disabled: isTaken,
  }
}

/** The languages to pick, then the ones already there, under their own label. */
const items = computed<SelectMenuItem[][]>(() => {
  const taken = new Set(props.taken)
  const free = props.options.filter((option) => !taken.has(option.code))
  const added = props.options.filter((option) => taken.has(option.code))
  const groups = [free.map((option) => itemOf(option, false))]
  if (!added.length) return groups
  const label = {
    type: 'label' as const,
    label: t('dms_lang.language_add.already_added'),
  }
  return [...groups, [label, ...added.map((option) => itemOf(option, true))]]
})
</script>

<template>
  <USelectMenu
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
