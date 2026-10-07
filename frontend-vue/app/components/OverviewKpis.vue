<script setup lang="ts">
import { namespaceCount } from '../utils/translations'

interface KpiItem {
  id: string
  icon: string
  tone: 'primary' | 'warning' | 'success' | 'neutral'
  eyebrow: string
  value: string
  detail: string
}

const { t } = useI18n()
const { formatCount } = useLangFormat()
const { flat, isLoaded } = useWorkspaceFlat()

const targetLocales = computed(() =>
  flat.value.locales.filter((code) => code !== flat.value.defaultLocale),
)

const missing = computed(() =>
  targetLocales.value.reduce(
    (total, code) => total + (flat.value.localeMissing[code] ?? 0),
    0,
  ),
)

const coverage = computed(() => {
  const targets = targetLocales.value
  if (targets.length === 0) return 100
  const sum = targets.reduce(
    (total, code) => total + (flat.value.localeProgress[code] ?? 0),
    0,
  )
  return Math.round(sum / targets.length)
})

const items = computed<KpiItem[]>(() => [
  {
    id: 'languages',
    icon: 'i-ph-globe',
    tone: 'primary',
    eyebrow: t('dms_lang.kpis.languages'),
    value: formatCount(flat.value.locales.length),
    detail: t('dms_lang.kpis.languages_detail', targetLocales.value.length),
  },
  {
    id: 'keys',
    icon: 'i-ph-key',
    tone: 'neutral',
    eyebrow: t('dms_lang.kpis.keys'),
    value: formatCount(flat.value.totalKeys),
    detail: t('dms_lang.kpis.keys_detail', namespaceCount(flat.value.rows)),
  },
  {
    id: 'missing',
    icon: 'i-ph-warning',
    tone: missing.value > 0 ? 'warning' : 'success',
    eyebrow: t('dms_lang.kpis.missing'),
    value: formatCount(missing.value),
    detail: t('dms_lang.kpis.missing_detail', targetLocales.value.length),
  },
  {
    id: 'coverage',
    icon: 'i-ph-chart-bar',
    tone: 'primary',
    eyebrow: t('dms_lang.kpis.coverage'),
    value: flat.value.totalKeys ? `${formatCount(coverage.value)}%` : '—',
    detail: t('dms_lang.kpis.coverage_detail'),
  },
])
</script>

<template>
  <DmsStatGroup
    layout="cards"
    :items="items"
    :loading="!isLoaded"
    :label="$t('dms_lang.kpis.label')"
  />
</template>
