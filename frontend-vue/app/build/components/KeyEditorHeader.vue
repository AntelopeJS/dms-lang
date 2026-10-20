<script setup lang="ts">
import type { KeyPanelHeader } from '../../types/lang'
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
const shown = computed(() => props.header())
</script>

<template>
  <div v-if="shown" class="flex items-start gap-2">
    <div class="min-w-0 flex-1 space-y-1.5">
      <DmsEyebrow
        as="span"
        :label="
          shown.crumbs
            ? $t('dms_lang.drawer.eyebrow', { path: shown.crumbs })
            : $t('dms_lang.drawer.key')
        "
        size="xs"
        truncate
      />
      <!-- Not a heading: the drawer's (visually hidden) title already names
        the dialog after the key. -->
      <p
        class="text-highlighted font-mono text-[15px] leading-[1.3] font-semibold break-all"
      >
        {{ shown.key }}
      </p>
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
    <div class="flex shrink-0 items-center">
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
