<script setup lang="ts">
import LocaleTile from '../build/components/LocaleTile.vue'
import {
  HIGH_COVERAGE,
  MID_COVERAGE,
  coverageTone,
  namespaceCoverage,
} from '../utils/translations'

const MAX_NAMESPACES = 6
const MAX_LOCALES = 5

const HEAT_CLASSES: Record<'success' | 'warning' | 'error', string> = {
  success: 'bg-success/15 text-success ring-success/25',
  warning: 'bg-warning/15 text-warning ring-warning/25',
  error: 'bg-error/15 text-error ring-error/25',
}

const { flat, isLoaded } = useWorkspaceFlat()
const { formatCount } = useLangFormat()
const links = useLangLinks()
const { current } = useWorkspaceContext()
const { nativeName } = useLocaleNames()
const { addLanguage } = useLanguageActions()

const isFirstRun = computed(
  () =>
    isLoaded.value &&
    current.value?.kind === 'added' &&
    flat.value.totalKeys === 0,
)

const locales = computed(() =>
  flat.value.locales
    .filter((code) => code !== flat.value.defaultLocale)
    .sort(
      (left, right) =>
        (flat.value.localeProgress[right] ?? 0) -
        (flat.value.localeProgress[left] ?? 0),
    )
    .slice(0, MAX_LOCALES),
)

const namespaces = computed(() =>
  namespaceCoverage(flat.value.rows, locales.value)
    .sort((left, right) => right.keys - left.keys)
    .slice(0, MAX_NAMESPACES),
)

const gridTemplate = computed(
  () =>
    `minmax(6rem, 1fr) repeat(${locales.value.length}, minmax(2.5rem, 3rem))`,
)
</script>

<template>
  <DmsCard :padded="false" :title="$t('dms_lang.namespaces.title')">
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

    <div
      v-else-if="isFirstRun"
      class="flex flex-col items-center gap-3 px-4 py-6 text-center"
    >
      <p class="text-highlighted text-sm font-semibold">
        {{ $t('dms_lang.first_run.title', { name: current?.id }) }}
      </p>
      <DmsCheckList
        size="sm"
        :items="[
          {
            id: 'created',
            label: $t('dms_lang.first_run.created', {
              base: nativeName(flat.defaultLocale),
            }),
            state: 'ok',
          },
          {
            id: 'keys',
            label: $t('dms_lang.first_run.keys'),
            state: 'pending',
          },
          {
            id: 'languages',
            label: $t('dms_lang.first_run.languages'),
            state: flat.locales.length > 1 ? 'ok' : 'pending',
          },
        ]"
      />
      <div class="flex flex-wrap justify-center gap-2">
        <UButton
          icon="i-ph-plus"
          size="sm"
          :label="$t('dms_lang.first_run.add_key')"
          :to="links.translations({ [PAGE_ACTION_QUERY]: PAGE_ACTIONS.addKey })"
        />
        <UButton
          size="sm"
          color="neutral"
          variant="outline"
          :label="$t('dms_lang.first_run.add_language')"
          @click="addLanguage()"
        />
      </div>
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

    <div v-else class="overflow-x-auto px-4 pb-4 pt-3">
      <div
        class="grid items-center gap-1.5"
        :style="{ gridTemplateColumns: gridTemplate }"
      >
        <span />
        <span
          v-for="code in locales"
          :key="code"
          class="flex justify-center"
          :title="code"
        >
          <LocaleTile :code="code" size="sm" />
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
            :to="
              links.translations({
                namespace: entry.namespace,
                missingIn: code,
                filter: 'missing',
              })
            "
            class="grid h-8 place-items-center rounded-md font-mono text-xs font-semibold ring-1 ring-inset transition-opacity hover:opacity-80"
            :class="HEAT_CLASSES[coverageTone(entry.coverage[code] ?? 0)]"
            :aria-label="
              $t('dms_lang.namespaces.cell', {
                namespace: entry.namespace,
                code,
                coverage: entry.coverage[code],
              })
            "
          >
            {{ entry.coverage[code] }}
          </ULink>
        </template>
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
