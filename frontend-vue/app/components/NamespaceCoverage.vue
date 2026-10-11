<script setup lang="ts">
import { useWorkspaceFlatSync } from '../composables/translation/useWorkspaceFlat'
import UButton from '@nuxt/ui/components/Button.vue'
import type { NamespaceCoverage } from '../types/lang'
import LocaleTile from '../build/components/LocaleTile.vue'
import {
  HIGH_COVERAGE,
  MID_COVERAGE,
  coveragePercent,
  coverageTone,
  namespaceCoverage,
} from '../utils/translations'

const MAX_NAMESPACES = 6
const MAX_LOCALES = 6

const HEAT_CLASSES: Record<'success' | 'warning' | 'error', string> = {
  success: 'bg-success/15 text-success ring-success/25',
  warning: 'bg-warning/15 text-warning ring-warning/25',
  error: 'bg-error/15 text-error ring-error/25',
}

const { t } = useI18n()
const { flat, isLoaded } = useWorkspaceFlat()
useWorkspaceFlatSync()
const { formatCount } = useLangFormat()
const links = useLangLinks()
const { canManage, isResolved, isUnknown } = useWorkspaceContext()
const { nameAmong } = useLocaleNames()
const { addLanguage } = useLanguageActions()

function missingCount(code: string): number {
  return flat.value.localeMissing[code] ?? 0
}

const targets = computed(() =>
  flat.value.locales
    .filter((code) => code !== flat.value.defaultLocale)
    .sort(
      (left, right) =>
        (flat.value.localeProgress[left] ?? 0) -
          (flat.value.localeProgress[right] ?? 0) ||
        missingCount(right) - missingCount(left) ||
        left.localeCompare(right),
    ),
)
const locales = computed(() => targets.value.slice(0, MAX_LOCALES))
const hiddenLocales = computed(
  () => targets.value.length - locales.value.length,
)

function totalMissing(entry: NamespaceCoverage): number {
  return Object.values(entry.missing).reduce((sum, count) => sum + count, 0)
}

const allNamespaces = computed(() =>
  namespaceCoverage(flat.value.rows, targets.value).sort(
    (left, right) =>
      totalMissing(right) / right.keys - totalMissing(left) / left.keys ||
      totalMissing(right) - totalMissing(left) ||
      left.namespace.localeCompare(right.namespace),
  ),
)
const namespaces = computed(() => allNamespaces.value.slice(0, MAX_NAMESPACES))
const hiddenNamespaces = computed(
  () => allNamespaces.value.length - namespaces.value.length,
)

const neediest = computed(() => targets.value[0] ?? '')
const neediestMissing = computed(() => missingCount(neediest.value))

function shownCoverage(entry: NamespaceCoverage, code: string): number {
  return coveragePercent(entry.keys - (entry.missing[code] ?? 0), entry.keys)
}

function cellLink(entry: NamespaceCoverage, code: string): string {
  if (!entry.missing[code]) {
    return links.translations({ namespace: entry.namespace })
  }
  return links.translations({
    namespace: entry.namespace,
    missingIn: code,
    filter: 'missing',
  })
}

function cellLabel(entry: NamespaceCoverage, code: string): string {
  const missing = entry.missing[code] ?? 0
  const params = {
    namespace: entry.namespace,
    name: nameAmong(code, targets.value),
    missing: formatCount(missing),
    keys: formatCount(entry.keys),
  }
  if (!missing) return t('dms_lang.namespaces.cell_complete', params)
  return t('dms_lang.namespaces.cell_missing', params, missing)
}

const gridTemplate = computed(
  () =>
    `minmax(6rem, 1fr) repeat(${locales.value.length}, minmax(2.5rem, 3rem))`,
)

usePageHeaderActions(() => [
  canManage.value
    ? h(UButton, {
        label: t('dms_lang.languages.add'),
        icon: 'i-ph-plus',
        color: 'neutral',
        variant: 'outline',
        onClick: () => addLanguage(),
      })
    : null,
  isResolved.value && neediestMissing.value
    ? h(UButton, {
        label: t(
          'dms_lang.namespaces.translate_in',
          {
            count: formatCount(neediestMissing.value),
            name: nameAmong(neediest.value, targets.value),
          },
          neediestMissing.value,
        ),
        icon: 'i-ph-translate',
        to: links.translations({
          filter: 'missing',
          missingIn: neediest.value,
        }),
      })
    : null,
])
</script>

<template>
  <DmsCard
    v-if="!isUnknown"
    :padded="false"
    :title="$t('dms_lang.namespaces.title')"
  >
    <template #actions>
      <UButton
        size="xs"
        color="neutral"
        variant="ghost"
        trailing-icon="i-ph-arrow-right"
        :label="$t('dms_lang.namespaces.open_matrix')"
        :to="links.translations()"
      />
    </template>

    <div v-if="!isLoaded" class="space-y-2 p-4">
      <USkeleton v-for="index in 4" :key="index" class="h-8 w-full" />
    </div>

    <p
      v-else-if="!locales.length || !namespaces.length"
      class="text-muted px-4 py-8 text-center text-sm"
    >
      {{
        namespaces.length
          ? $t('dms_lang.namespaces.no_targets')
          : $t('dms_lang.namespaces.no_keys')
      }}
    </p>

    <div v-else class="overflow-x-auto px-4 pt-3 pb-4">
      <div
        class="grid items-center gap-1.5"
        :style="{ gridTemplateColumns: gridTemplate }"
      >
        <span />
        <span
          v-for="code in locales"
          :key="code"
          class="flex justify-center"
          :title="`${nameAmong(code, targets)} · ${code}`"
        >
          <LocaleTile :code="code" :siblings="targets" size="sm" />
        </span>
        <template v-for="entry in namespaces" :key="entry.namespace">
          <span class="flex min-w-0 items-baseline gap-1.5">
            <span class="text-highlighted truncate font-mono text-xs">
              {{ entry.namespace }}
            </span>
            <span class="text-dimmed font-mono text-[10.5px]">
              {{ formatCount(entry.keys) }}
            </span>
          </span>
          <ULink
            v-for="code in locales"
            :key="code"
            :to="cellLink(entry, code)"
            class="grid h-8 place-items-center rounded-md font-mono text-xs font-semibold ring-1 transition-opacity ring-inset hover:opacity-80"
            :class="HEAT_CLASSES[coverageTone(shownCoverage(entry, code))]"
            :title="cellLabel(entry, code)"
            :aria-label="cellLabel(entry, code)"
          >
            {{ shownCoverage(entry, code) }}
          </ULink>
        </template>
      </div>

      <div
        v-if="hiddenLocales || hiddenNamespaces"
        class="text-muted mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs"
      >
        <span v-if="hiddenLocales">
          {{
            $t(
              'dms_lang.namespaces.more_locales',
              { count: formatCount(hiddenLocales) },
              hiddenLocales,
            )
          }}
        </span>
        <span v-if="hiddenNamespaces">
          {{
            $t(
              'dms_lang.namespaces.more_namespaces',
              { count: formatCount(hiddenNamespaces) },
              hiddenNamespaces,
            )
          }}
        </span>
        <ULink
          :to="links.translations()"
          class="text-primary ml-auto font-medium hover:underline"
        >
          {{ $t('dms_lang.namespaces.see_all') }}
        </ULink>
      </div>
    </div>

    <template v-if="isLoaded && namespaces.length && locales.length" #footer>
      <div class="text-dimmed flex flex-wrap items-center gap-3 text-xs">
        <span class="inline-flex items-center gap-1.5">
          <span class="bg-success size-2 rounded-sm" />
          ≥ {{ HIGH_COVERAGE }}%
        </span>
        <span class="inline-flex items-center gap-1.5">
          <span class="bg-warning size-2 rounded-sm" />
          {{ MID_COVERAGE }}–{{ HIGH_COVERAGE - 1 }}%
        </span>
        <span class="inline-flex items-center gap-1.5">
          <span class="bg-error size-2 rounded-sm" />
          &lt; {{ MID_COVERAGE }}%
        </span>
        <span class="ml-auto">{{ $t('dms_lang.namespaces.legend') }}</span>
      </div>
    </template>
  </DmsCard>
</template>
