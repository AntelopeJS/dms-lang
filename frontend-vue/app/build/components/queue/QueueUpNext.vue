<script setup lang="ts">
import { stringValue } from '../../../utils/translations'
import { useQueue } from '../../composables/useQueueContext'

const { session } = useQueue()
const { upNext, drafts, baseLocale } = session
</script>

<template>
  <ul
    v-if="upNext.length"
    class="border-default divide-default divide-y border-t"
  >
    <li
      v-for="(entry, offset) in upNext"
      :key="entry.row.key"
      class="grid grid-cols-[4rem_minmax(0,16rem)_minmax(0,1fr)] items-center gap-3 px-4 py-2"
    >
      <DmsEyebrow
        v-if="offset === 0"
        :label="$t('dms_lang.queue.up_next')"
        size="xs"
      />
      <span v-else />
      <button
        type="button"
        class="hover:text-primary flex min-w-0 items-center gap-1.5 text-left font-mono text-xs"
        @click="session.goTo(entry.index)"
      >
        <span class="truncate">{{ entry.row.key }}</span>
        <DmsStatusPill
          v-if="drafts.has(entry.row.key)"
          dot="none"
          size="sm"
          tone="warning"
          :label="$t('dms_lang.queue.draft')"
        />
        <DmsStatusPill
          v-else-if="entry.isSkipped"
          dot="none"
          size="sm"
          tone="neutral"
          :label="$t('dms_lang.queue.status_skipped')"
        />
        <DmsStatusPill
          v-else-if="session.isOutdated(entry.row)"
          dot="none"
          size="sm"
          tone="warning"
          :label="$t('dms_lang.queue.status_outdated')"
        />
      </button>
      <span class="text-muted truncate text-sm">
        {{ stringValue(entry.row.values[baseLocale]) }}
      </span>
    </li>
    <li class="text-dimmed px-4 py-1.5 text-xs">
      {{ $t('dms_lang.queue.order') }}
    </li>
  </ul>
</template>
