<script setup lang="ts">
import { coveragePercent, coverageTone } from '../utils/translations'

const RING_RADIUS = 40
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS
const RING_STROKE: Record<'success' | 'warning' | 'error', string> = {
  success: 'stroke-success',
  warning: 'stroke-warning',
  error: 'stroke-error',
}

const { flat, isLoaded } = useWorkspaceFlat()
const { formatCount } = useLangFormat()
const { translated, issueTotal, exists } = useLanguageQueue()

const total = computed(() => flat.value.rows.length)
const coverage = computed(() => coveragePercent(translated.value, total.value))
const missing = computed(() => total.value - translated.value)
const dashOffset = computed(
  () => RING_CIRCUMFERENCE * (1 - coverage.value / 100),
)
</script>

<template>
  <DmsCard v-if="exists || !isLoaded" padded>
    <div class="flex items-center gap-5">
      <div class="relative size-24 shrink-0">
        <svg
          viewBox="0 0 100 100"
          class="size-full -rotate-90"
          aria-hidden="true"
        >
          <circle
            cx="50"
            cy="50"
            :r="RING_RADIUS"
            fill="none"
            stroke-width="8"
            class="stroke-(--dms-bg-muted)"
          />
          <circle
            v-if="isLoaded"
            cx="50"
            cy="50"
            :r="RING_RADIUS"
            fill="none"
            stroke-width="8"
            stroke-linecap="round"
            :class="RING_STROKE[coverageTone(coverage)]"
            :stroke-dasharray="RING_CIRCUMFERENCE"
            :stroke-dashoffset="dashOffset"
          />
        </svg>
        <span
          class="text-highlighted absolute inset-0 grid place-items-center font-mono text-xl font-semibold"
        >
          <span v-if="isLoaded">
            {{ coverage }}
            <small class="text-dimmed text-xs">%</small>
          </span>
        </span>
      </div>
      <dl class="grid flex-1 grid-cols-2 gap-x-4 gap-y-3">
        <div>
          <DmsEyebrow
            as="dt"
            :label="$t('dms_lang.progress.translated')"
            size="xs"
          />
          <dd class="text-highlighted font-mono text-xl font-semibold">
            <USkeleton v-if="!isLoaded" class="h-6 w-12" />
            <template v-else>{{ formatCount(translated) }}</template>
          </dd>
        </div>
        <div>
          <DmsEyebrow
            as="dt"
            :label="$t('dms_lang.progress.missing')"
            size="xs"
          />
          <dd class="text-warning font-mono text-xl font-semibold">
            <USkeleton v-if="!isLoaded" class="h-6 w-12" />
            <template v-else>{{ formatCount(missing) }}</template>
          </dd>
        </div>
        <div class="col-span-2">
          <DmsEyebrow
            as="dt"
            :label="$t('dms_lang.progress.issues')"
            size="xs"
          />
          <dd
            class="font-mono text-xl font-semibold"
            :class="issueTotal ? 'text-error' : 'text-highlighted'"
          >
            <USkeleton v-if="!isLoaded" class="h-6 w-12" />
            <template v-else>{{ formatCount(issueTotal) }}</template>
          </dd>
        </div>
      </dl>
    </div>
  </DmsCard>
</template>
