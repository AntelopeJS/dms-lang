<script setup lang="ts">
import type { KeyPanelHeader } from '../../types/lang'
import { NAMESPACE_SEPARATOR } from '../../utils/translations'
import PlaceholderText from './PlaceholderText.vue'

interface Props {
  /**
   * What the panel's body (`KeyEditorDrawer`) hands over for the key it
   * shows. A getter: the drawer keeps its options in a reactive object,
   * which would unwrap a ref.
   */
  header: () => KeyPanelHeader | null
}

const props = defineProps<Props>()
const { t, locale } = useI18n()

const shown = computed(() => props.header())

// The key wraps after its separators, never inside a namespace: each segment
// but the last keeps the separator that follows it.
const segments = computed(() => {
  const parts = shown.value?.key.split(NAMESPACE_SEPARATOR) ?? []
  return parts.map((part, index) =>
    index < parts.length - 1 ? `${part}${NAMESPACE_SEPARATOR}` : part,
  )
})

// "12 of 1,338", as the DMS row header words a row's place (in the locale's
// grouping). A key opened off the matrix's list has no place in it.
const position = computed(() => {
  const header = shown.value
  if (!header || header.index < 0) return ''
  const format = new Intl.NumberFormat(locale.value)
  return t('dms_lang.drawer.position', {
    index: format.format(header.index + 1),
    total: format.format(header.total),
  })
})
</script>

<!-- The DMS row header's layout (a row drawer's): the key as the title, its
  place among the matrix's keys under it, previous / next beside it; the
  drawer adds its close button. The namespaces above the key follow the
  place, and wrap rather than run under the buttons on a phone. -->
<template>
  <div v-if="shown" class="flex min-w-0 items-start gap-2">
    <div class="min-w-0 flex-1 space-y-1.5">
      <div>
        <!-- Not a heading: the drawer's (visually hidden) title already names
          the dialog after the key. -->
        <p
          data-key-panel-title
          class="text-highlighted font-mono text-[15px] leading-[1.3] font-semibold [overflow-wrap:anywhere]"
        >
          <template v-for="(segment, index) in segments" :key="index">
            <span>{{ segment }}</span>
            <wbr />
          </template>
        </p>
        <p
          v-if="position || shown.crumbs"
          class="text-muted mt-0.5 flex flex-wrap items-baseline gap-x-1.5 text-[12.5px]"
        >
          <span v-if="position" data-key-panel-position class="tabular-nums">
            {{ position }}
          </span>
          <span v-if="position && shown.crumbs" aria-hidden="true">·</span>
          <span
            v-if="shown.crumbs"
            data-key-panel-crumbs
            class="min-w-0 font-mono [overflow-wrap:anywhere]"
          >
            {{ shown.crumbs }}
          </span>
        </p>
      </div>
      <div
        v-if="shown.missingCount || shown.issueCount || shown.placeholders"
        class="flex flex-wrap items-center gap-1.5"
      >
        <DmsStatusPill
          v-if="shown.missingCount"
          dot="none"
          tone="warning"
          size="sm"
          :label="$t('dms_lang.drawer.missing', shown.missingCount)"
        />
        <DmsStatusPill
          v-if="shown.issueCount"
          dot="none"
          tone="error"
          size="sm"
          icon="i-ph-warning"
          :label="$t('dms_lang.drawer.issues', shown.issueCount)"
        />
        <span
          v-if="shown.placeholders"
          class="text-dimmed inline-flex items-center gap-1.5 text-xs"
        >
          <UIcon name="i-ph-brackets-curly" class="size-3.5" />
          {{ $t('dms_lang.drawer.placeholders') }}
          <PlaceholderText :text="shown.placeholders" />
        </span>
      </div>
    </div>
    <div class="flex shrink-0 items-center gap-0.5">
      <UButton
        icon="i-ph-caret-up"
        color="neutral"
        variant="ghost"
        size="sm"
        square
        :disabled="!shown.hasPrevious"
        :aria-label="$t('dms_lang.drawer.previous')"
        @click="shown.previous()"
      />
      <UButton
        icon="i-ph-caret-down"
        color="neutral"
        variant="ghost"
        size="sm"
        square
        :disabled="!shown.hasNext"
        :aria-label="$t('dms_lang.drawer.next')"
        @click="shown.next()"
      />
    </div>
  </div>
</template>
