<script setup lang="ts">
import {
  QUEUE_MODES,
  type QueueMode,
} from '../../../composables/translation/useLanguageQueue'
import { useQueue } from '../../composables/useQueueContext'

/** The title and the description of the end of a pass. */
interface DoneTexts {
  title: () => string
  description: () => string
}

interface DoneAction {
  label: string
  icon?: string
  color?: 'primary' | 'neutral'
  variant?: 'solid' | 'outline'
  to?: string
  onClick?: () => void
}

const { t } = useI18n()
const { formatCount } = useLangFormat()
const { flat } = useWorkspaceFlat()
const links = useLangLinks()
const { session, languageName, nameOf } = useQueue()
const { mode, namespace, counts, missingTotal, queue, otherLanguages } = session

function missingOf(code: string): number {
  return flat.value.localeMissing[code] ?? 0
}

const missingElsewhere = computed(
  () => missingTotal.value - counts.value.missing,
)

function languageDescription(): string {
  const name = languageName.value
  if (missingTotal.value)
    return t(
      'dms_lang.queue.still_missing',
      { n: formatCount(missingTotal.value), name },
      missingTotal.value,
    )
  const total = flat.value.totalKeys
  return t(
    'dms_lang.queue.done_description',
    { count: formatCount(total), name },
    total,
  )
}

const DONE_TEXTS: Record<QueueMode, DoneTexts> = {
  missing: {
    title: () => t('dms_lang.queue.done_title', { name: languageName.value }),
    description: languageDescription,
  },
  issues: {
    title: () => t('dms_lang.queue.no_issues_title'),
    description: () => t('dms_lang.queue.no_issues_description'),
  },
  all: {
    title: () => t('dms_lang.queue.reviewed_title'),
    description: languageDescription,
  },
}

/** A pass over one namespace: what is left is in the other namespaces. */
const SCOPED_TEXTS: DoneTexts = {
  title: () =>
    t('dms_lang.queue.done_scope_title', {
      namespace: namespace.value,
      name: languageName.value,
    }),
  description: () =>
    t(
      'dms_lang.queue.missing_elsewhere',
      { n: formatCount(missingElsewhere.value) },
      missingElsewhere.value,
    ),
}

/** Modes whose end says nothing about the namespace (no issue is no issue anywhere it was looked for). */
const UNSCOPED_MODES: QueueMode[] = ['issues']

const texts = computed(() =>
  namespace.value && !UNSCOPED_MODES.includes(mode.value)
    ? SCOPED_TEXTS
    : DONE_TEXTS[mode.value],
)

function restartAction(): DoneAction | null {
  if (!queue.value.length) return null
  return {
    label: t('dms_lang.queue.restart', {
      count: formatCount(queue.value.length),
    }),
    icon: 'i-ph-arrow-counter-clockwise',
    onClick: () => session.start(),
  }
}

function clearScopeAction(): DoneAction | null {
  if (!namespace.value || !missingElsewhere.value) return null
  return {
    label: t('dms_lang.language_namespaces.clear'),
    icon: 'i-ph-squares-four',
    onClick: () => (namespace.value = ''),
  }
}

/** The modes a finished pass offers to go on with, while they hold keys. */
const MODE_SWITCHES: Partial<Record<QueueMode, () => string>> = {
  missing: () => t('dms_lang.queue.translate_missing'),
  issues: () =>
    t('dms_lang.queue.review_issues', {
      count: formatCount(counts.value.issues),
    }),
}

function modeActions(): DoneAction[] {
  return QUEUE_MODES.filter(
    (other) => other !== mode.value && counts.value[other],
  ).flatMap((other) => {
    const label = MODE_SWITCHES[other]
    return label
      ? [{ label: label(), onClick: () => (mode.value = other) }]
      : []
  })
}

function nextLanguageAction(): DoneAction | null {
  const code = otherLanguages.value.find((entry) => missingOf(entry) > 0)
  if (!code) return null
  const missing = missingOf(code)
  return {
    label: t(
      'dms_lang.queue.next_language',
      { name: nameOf(code), n: formatCount(missing) },
      missing,
    ),
    icon: 'i-ph-arrow-right',
    to: links.language(code),
  }
}

function previousAction(): DoneAction | null {
  if (!session.canGoBack.value) return null
  return {
    label: t('dms_lang.queue.previous'),
    icon: 'i-ph-arrow-left',
    onClick: () => session.previous(),
  }
}

/** The ways on from the end of a pass, the first one as the main action. */
const actions = computed<DoneAction[]>(() =>
  [
    restartAction(),
    clearScopeAction(),
    ...modeActions(),
    nextLanguageAction(),
    previousAction(),
    { label: t('dms_lang.queue.back'), to: links.overview() },
  ]
    .filter((action): action is DoneAction => action !== null)
    .map((action, index) => ({
      color: index === 0 ? 'primary' : 'neutral',
      variant: index === 0 ? 'solid' : 'outline',
      ...action,
    })),
)
</script>

<template>
  <DmsEmptyState
    icon="i-ph-check-circle"
    tone="success"
    size="lg"
    :title="texts.title()"
    :description="texts.description()"
    :actions="actions"
  />
</template>
