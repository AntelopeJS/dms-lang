<script setup lang="ts">
import { useWorkspaceFlatSync } from '../composables/translation/useWorkspaceFlat'
import UButton from '@nuxt/ui/components/Button.vue'
import UDropdownMenu from '@nuxt/ui/components/DropdownMenu.vue'
import type { DropdownMenuItem } from '@nuxt/ui'
import { useDmsRouter } from '#dms/frontend-module'
import type { FlatTranslationRow } from '../types/lang'
import type { QueueStep } from '../composables/translation/useLanguageQueue'
import {
  checkMessage,
  escapeMessage,
  formatTokens,
  hasBlockingIssue,
  messageIssueText,
  placeholdersOf,
  replacePlaceholder,
  stringValue,
} from '../utils/translations'
import type { KeySaveFailureKind } from '../utils/keySaveErrors'
import { savedText as expectedTextOf } from '../utils/keySaves'
import LocaleTile from '../build/components/LocaleTile.vue'
import ShortcutKbds from '../build/components/ShortcutKbds.vue'
import PlaceholderText from '../build/components/PlaceholderText.vue'
import {
  useKeySaves,
  type KeyWriteFailed,
} from '../build/composables/useKeySaves'
import { useQueueShortcuts } from '../build/composables/useQueueShortcuts'
import { QUEUE_KEYS } from '../utils/shortcuts'

type SaveFailureHandler = (
  row: FlatTranslationRow,
  value: string,
  outcome: KeyWriteFailed,
) => void

interface Rejection {
  key: string
  value: string
  problems: string[]
}

interface DoneAction {
  label: string
  icon?: string
  color?: 'primary' | 'neutral'
  variant?: 'solid' | 'outline' | 'ghost'
  to?: string
  onClick?: () => void
}

const UP_NEXT = 4
const CONTEXT_LANGUAGES = 2
const JSON_INDENT = 2
const LONG_TEXT = 80
const URL_SYNC_MS = 400
const LANGUAGE_SUGGESTIONS = 6
const ARM_SEPARATOR = '\n'
const STEP_TOASTS: Partial<Record<QueueStep, string>> = {
  wrapped: 'dms_lang.queue.wrapped',
  last: 'dms_lang.queue.last_key',
}
/** Long enough to copy a draft whose key was deleted elsewhere. */
const DELETED_DRAFT_MS = 15000

// The root switches between a card and nothing (unknown workspace): the
// attributes the page hands down have no single element to land on.
defineOptions({ inheritAttrs: false })

const { t } = useI18n()
const toast = useToast()
const { confirm } = useConfirm()
const { formatCount } = useLangFormat()
const { selectedWorkspace, exportWorkspace } = useI18nWorkspaces()
const { flat, isLoaded } = useWorkspaceFlat()
useWorkspaceFlatSync()
const { canEditValues, canManage, isModules, isUnknown, allows } =
  useWorkspaceContext()
const { switchLink } = useWorkspaceRoute()
const { nativeName, fullName, nameAmong } = useLocaleNames()
const { reportFailure } = useMutationToast()
const saves = useKeySaves()
const { removeLanguage, makeBase } = useLanguageActions()
const { downloadFile } = useWorkspaceActions()
const links = useLangLinks()
const router = useDmsRouter()
const session = useQueueSession(UP_NEXT)
const {
  locale,
  baseLocale,
  isBase,
  exists,
  mode,
  namespace,
  queue,
  counts,
  missingTotal,
  current,
  currentStatus,
  pending,
  skippedCount,
  progress,
  upNext,
  isFinished,
  canGoBack,
  drafts,
} = session

const root = useTemplateRef<HTMLElement>('root')
const editor = useTemplateRef<{ textareaRef?: HTMLTextAreaElement }>('editor')
const isSaving = ref(false)
const isReviewing = ref(false)
const armedSave = ref('')
const rejection = ref<Rejection | null>(null)
let urlTimer: ReturnType<typeof setTimeout> | undefined

useUnsavedChanges({ dirty: () => drafts.count.value > 0 })

/** A language name, with its region when another language here shares it. */
const nameOf = (code: string) => nameAmong(code, flat.value.locales)
const languageName = computed(() => nameOf(locale.value))
const baseText = computed(() =>
  stringValue(current.value?.values[baseLocale.value]),
)
const savedText = computed(() =>
  stringValue(current.value?.values[locale.value]),
)
const draft = computed({
  get: () => {
    const stored = current.value ? drafts.read(current.value.key) : undefined
    return stored ?? savedText.value
  },
  set: (value: string) => {
    if (!current.value) return
    drafts.write(current.value.key, value, current.value.values[locale.value])
  },
})
const issues = computed(() => checkMessage(baseText.value, draft.value))
const isBlocked = computed(() => hasBlockingIssue(issues.value))
const escapedDraft = computed(() => escapeMessage(draft.value))
const tokensOf = (kind: 'missing' | 'extra') =>
  issues.value
    .filter((issue) => issue.kind === kind)
    .flatMap((issue) => issue.tokens)
const missingTokens = computed(() => tokensOf('missing'))
/** One variable renamed by mistake: the one to put back in its place. */
const replacement = computed(() => {
  const extra = tokensOf('extra')
  if (missingTokens.value.length !== 1 || extra.length !== 1) return undefined
  return { from: extra[0], to: missingTokens.value[0] }
})
const tokens = computed(() => placeholdersOf(baseText.value))
const armId = (key: string, value: string) => [key, value].join(ARM_SEPARATOR)
const isArmed = computed(
  () =>
    !!current.value &&
    armedSave.value === armId(current.value.key, draft.value),
)
const rejectedProblems = computed(() => {
  const rejected = rejection.value
  if (!rejected || rejected.key !== current.value?.key) return []
  return rejected.value === draft.value ? rejected.problems : []
})
/**
 * The value saved elsewhere since the draft was started (a conflict): shown
 * with the choice to keep it or to save the draft over it.
 */
const conflict = computed(() =>
  current.value && session.isStale(current.value) ? savedText.value : undefined,
)
const overrideLink = computed(() =>
  switchLink(DEFAULT_WORKSPACE, {
    page: 'translations',
    query: { key: current.value?.key },
  }),
)
const contextLocales = computed(() =>
  flat.value.locales
    .filter((code) => code !== baseLocale.value && code !== locale.value)
    .filter((code) => stringValue(current.value?.values[code]))
    .slice(0, CONTEXT_LANGUAGES),
)
const modeItems = computed(() => [
  {
    label: t('dms_lang.queue.mode_missing', {
      count: formatCount(counts.value.missing),
    }),
    value: 'missing',
  },
  {
    label: t('dms_lang.queue.mode_issues', {
      count: formatCount(counts.value.issues),
    }),
    value: 'issues',
  },
  {
    label: t('dms_lang.queue.mode_all', {
      count: formatCount(counts.value.all),
    }),
    value: 'all',
  },
])
const remainingLabel = computed(() => {
  const left = pending.value.length
  const remaining = t(
    'dms_lang.queue.remaining',
    { n: formatCount(left) },
    left,
  )
  if (!skippedCount.value) return remaining
  const skipped = t(
    'dms_lang.queue.skipped_count',
    { n: formatCount(skippedCount.value) },
    skippedCount.value,
  )
  return `${remaining} · ${skipped}`
})

function missingOf(code: string): number {
  return flat.value.localeMissing[code] ?? 0
}

function draftCountOf(workspace: string, code: string): number {
  return (
    drafts.groups.value.find(
      (group) => group.workspace === workspace && group.locale === code,
    )?.count ?? 0
  )
}

function languageStatus(code: string): string {
  if (code === baseLocale.value) return t('dms_lang.common.base')
  const missing = missingOf(code)
  const status = t(
    'dms_lang.queue.language_missing',
    { n: formatCount(missing) },
    missing,
  )
  const count = draftCountOf(selectedWorkspace.value, code)
  if (!count) return status
  const pending = t(
    'dms_lang.queue.drafts_count',
    { n: formatCount(count) },
    count,
  )
  return `${status} · ${pending}`
}

const languageItems = computed<DropdownMenuItem[][]>(() => [
  [
    { type: 'label', label: t('dms_lang.queue.switch_language') },
    ...flat.value.locales.map((code) => ({
      label: `${fullName(code)} · ${code}`,
      description: languageStatus(code),
      trailingIcon: code === locale.value ? 'i-ph-check' : undefined,
      to: links.language(code),
    })),
  ],
])
/** Links back to the drafts left in other languages and workspaces. */
const draftLinks = computed(() =>
  drafts.elsewhere.value.map((group) => {
    const sameWorkspace = group.workspace === selectedWorkspace.value
    const name = sameWorkspace ? nameOf(group.locale) : nativeName(group.locale)
    const where = sameWorkspace ? name : `${group.workspace} · ${name}`
    return {
      id: `${group.workspace}:${group.locale}`,
      label: `${where} (${formatCount(group.count)})`,
      to: sameWorkspace
        ? links.language(group.locale)
        : switchLink(group.workspace, {
            page: 'language',
            query: { locale: group.locale },
          }),
    }
  }),
)
const otherLanguages = computed(() =>
  flat.value.locales
    .filter((code) => code !== baseLocale.value && code !== locale.value)
    .sort((left, right) => missingOf(right) - missingOf(left)),
)
const nextLanguage = computed(() =>
  otherLanguages.value.find((code) => missingOf(code) > 0),
)
const missingElsewhere = computed(
  () => missingTotal.value - counts.value.missing,
)

const doneTitle = computed(() => {
  if (mode.value === 'issues') return t('dms_lang.queue.no_issues_title')
  if (namespace.value) {
    return t('dms_lang.queue.done_scope_title', {
      namespace: namespace.value,
      name: languageName.value,
    })
  }
  if (mode.value === 'all') return t('dms_lang.queue.reviewed_title')
  return t('dms_lang.queue.done_title', { name: languageName.value })
})
const doneDescription = computed(() => {
  if (mode.value === 'issues') return t('dms_lang.queue.no_issues_description')
  if (namespace.value) {
    const count = missingElsewhere.value
    return t(
      'dms_lang.queue.missing_elsewhere',
      { n: formatCount(count) },
      count,
    )
  }
  if (missingTotal.value) {
    return t(
      'dms_lang.queue.still_missing',
      { n: formatCount(missingTotal.value), name: languageName.value },
      missingTotal.value,
    )
  }
  return t(
    'dms_lang.queue.done_description',
    { count: formatCount(flat.value.totalKeys), name: languageName.value },
    flat.value.totalKeys,
  )
})

function nextLanguageAction(): DoneAction[] {
  const code = nextLanguage.value
  if (!code) return []
  const missing = missingOf(code)
  return [
    {
      label: t(
        'dms_lang.queue.next_language',
        { name: nameOf(code), n: formatCount(missing) },
        missing,
      ),
      icon: 'i-ph-arrow-right',
      to: links.language(code),
    },
  ]
}

const doneActions = computed<DoneAction[]>(() =>
  [
    queue.value.length
      ? {
          label: t('dms_lang.queue.restart', {
            count: formatCount(queue.value.length),
          }),
          icon: 'i-ph-arrow-counter-clockwise',
          onClick: () => session.start(),
        }
      : null,
    namespace.value && missingElsewhere.value
      ? {
          label: t('dms_lang.language_namespaces.clear'),
          icon: 'i-ph-squares-four',
          onClick: () => (namespace.value = ''),
        }
      : null,
    mode.value !== 'missing' && counts.value.missing
      ? {
          label: t('dms_lang.queue.translate_missing'),
          onClick: () => (mode.value = 'missing'),
        }
      : null,
    mode.value !== 'issues' && counts.value.issues
      ? {
          label: t('dms_lang.queue.review_issues', {
            count: formatCount(counts.value.issues),
          }),
          onClick: () => (mode.value = 'issues'),
        }
      : null,
    ...nextLanguageAction(),
    canGoBack.value
      ? {
          label: t('dms_lang.queue.previous'),
          icon: 'i-ph-arrow-left',
          onClick: () => session.previous(),
        }
      : null,
    { label: t('dms_lang.queue.back'), to: links.overview() },
  ]
    .filter((action): action is DoneAction => action !== null)
    .map((action, index) => ({
      color: index === 0 ? 'primary' : 'neutral',
      variant: index === 0 ? 'solid' : 'outline',
      ...action,
    })),
)

const unknownActions = computed(() => [
  ...otherLanguages.value.slice(0, LANGUAGE_SUGGESTIONS).map((code) => ({
    label: t('dms_lang.queue.unknown_pick', { name: nameOf(code) }),
    color: 'neutral' as const,
    variant: 'outline' as const,
    to: links.language(code),
  })),
  {
    label: t('dms_lang.queue.back'),
    icon: 'i-ph-arrow-left',
    color: 'neutral' as const,
    variant: 'ghost' as const,
    to: links.overview(),
  },
])

function showStep(result: QueueStep | undefined) {
  const title = result ? STEP_TOASTS[result] : undefined
  if (!title) return
  toast.add({ title: t(title), color: 'neutral', icon: 'i-ph-arrow-u-up-left' })
}

function skip() {
  showStep(session.skip())
}

/** The base text changed since this translation was written. */
const isOutdated = computed(
  () => !!current.value && session.isOutdated(current.value),
)

/** Acknowledges "To review" without changing the text, then moves on. */
async function markReviewed() {
  const row = current.value
  if (!row || isReviewing.value) return
  isReviewing.value = true
  const outcome = await saves.markReviewed(
    { workspace: selectedWorkspace.value, key: row.key },
    locale.value,
  )
  isReviewing.value = false
  if (outcome.status === 'failed') return onReviewFailed(row, outcome)
  toast.add({
    title: t('dms_lang.drawer.reviewed', { code: locale.value, key: row.key }),
    color: 'success',
    icon: 'i-ph-check',
  })
  showStep(session.complete(row.key))
}

function onReviewFailed(row: FlatTranslationRow, outcome: KeyWriteFailed) {
  if (outcome.failure.kind === 'deleted') return onDeleted(row)
  reportFailure(outcome.error)
}

function useTheirs() {
  if (current.value) drafts.drop(current.value.key)
}

/** Saves the draft over the value saved elsewhere meanwhile. */
function overwrite() {
  if (!current.value) return
  drafts.rebase(current.value.key, current.value.values[locale.value])
  void save()
}

function warnConflict(key: string) {
  toast.add({
    title: t('dms_lang.queue.conflict_title', { key }),
    description: t('dms_lang.queue.conflict_description'),
    color: 'warning',
    icon: 'i-ph-warning',
  })
}

async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value)
    toast.add({ title: t('dms_lang.queue.copied'), color: 'success' })
  } catch {
    // No clipboard access: the text itself, to select and copy by hand.
    toast.add({
      title: t('dms_lang.queue.copy_failed'),
      description: value,
      color: 'warning',
      icon: 'i-ph-copy',
      duration: DELETED_DRAFT_MS,
    })
  }
}

/** Says a key left the queue because it was deleted elsewhere, offering its draft. */
function announceDeleted(key: string, draftText = '') {
  const hasDraft = !!draftText.trim()
  toast.add({
    title: t('dms_lang.queue.deleted_title', { key }),
    description: t(
      hasDraft
        ? 'dms_lang.queue.deleted_draft'
        : 'dms_lang.queue.deleted_description',
    ),
    color: 'warning',
    icon: 'i-ph-trash',
    ...(hasDraft
      ? {
          duration: DELETED_DRAFT_MS,
          actions: [
            {
              label: t('dms_lang.queue.copy_draft'),
              icon: 'i-ph-copy',
              color: 'neutral' as const,
              variant: 'outline' as const,
              onClick: () => void copyText(draftText),
            },
          ],
        }
      : {}),
  })
}

function onDeleted(row: FlatTranslationRow) {
  const draftText = drafts.read(row.key)
  drafts.drop(row.key)
  saves.dropRow({ workspace: selectedWorkspace.value, key: row.key })
  announceDeleted(row.key, draftText)
}

const SAVE_FAILURES: Record<KeySaveFailureKind, SaveFailureHandler> = {
  conflict: (row) => warnConflict(row.key),
  deleted: (row) => onDeleted(row),
  invalid: (row, value, outcome) => {
    const { details } = outcome.failure
    rejection.value = {
      key: row.key,
      value: drafts.read(row.key) ?? value,
      problems: details.length ? details : [outcome.message],
    }
  },
  other: (row, value, outcome) =>
    reportFailure(outcome.error, {
      title: t('dms_lang.matrix.save_failed', {
        key: row.key,
        code: locale.value,
      }),
      retry: () => void write(row, value),
    }),
}

async function write(row: FlatTranslationRow, value: string, advance = true) {
  isSaving.value = true
  const start = drafts.startOf(row.key)
  const outcome = await saves.write({
    workspace: selectedWorkspace.value,
    key: row.key,
    values: { [locale.value]: value },
    expected: {
      [locale.value]:
        start === undefined ? expectedTextOf(row.values[locale.value]) : start,
    },
  })
  isSaving.value = false
  if (outcome.status === 'failed')
    return SAVE_FAILURES[outcome.failure.kind](row, value, outcome)
  drafts.drop(row.key)
  showStep(session.complete(row.key, advance))
}

function confirmClear(row: FlatTranslationRow): Promise<boolean> {
  return confirm({
    title: t('dms_lang.queue.clear_title', {
      name: languageName.value,
      key: row.key,
    }),
    description: t('dms_lang.queue.clear_description', {
      name: languageName.value,
    }),
    color: 'warning',
    icon: 'i-ph-eraser',
    confirmLabel: t('dms_lang.queue.clear_submit'),
    initialFocus: 'cancel',
  })
}

function warnBlocked() {
  toast.add({
    title: t('dms_lang.queue.blocked'),
    color: 'error',
    icon: 'i-ph-warning-circle',
  })
}

/** Saves the draft, then moves on unless `advance` is false. */
async function save(advance = true) {
  const row = current.value
  if (!row || isSaving.value || !canEditValues.value) return
  const value = normalizeDraft(draft.value)
  if (value === savedText.value) {
    drafts.drop(row.key)
    return showStep(value ? session.complete(row.key) : session.skip())
  }
  if (conflict.value !== undefined) return warnConflict(row.key)
  if (isBlocked.value) return warnBlocked()
  if (issues.value.length && !isArmed.value) {
    armedSave.value = armId(row.key, draft.value)
    return
  }
  if (!value && !(await confirmClear(row))) return
  await write(row, value, advance)
}

function saveInPlace() {
  if (current.value && drafts.has(current.value.key)) void save(false)
}

/** Puts the text in the field, the caret at `caret` (the end by default). */
async function rewrite(value: string, caret = value.length) {
  draft.value = value
  await nextTick()
  const field = editor.value?.textareaRef
  field?.focus()
  field?.setSelectionRange(caret, caret)
}

/** Writes a variable where the caret is (over the selection). */
function insertToken(token: string) {
  const text = formatTokens([token])
  const field = editor.value?.textareaRef
  const start = field?.selectionStart ?? draft.value.length
  const end = field?.selectionEnd ?? draft.value.length
  void rewrite(
    `${draft.value.slice(0, start)}${text}${draft.value.slice(end)}`,
    start + text.length,
  )
}

function replaceToken(from: string, to: string) {
  void rewrite(replacePlaceholder(draft.value, from, to))
}

async function download() {
  try {
    const messages = await exportWorkspace(selectedWorkspace.value)
    downloadFile(
      `${locale.value}.json`,
      JSON.stringify(messages[locale.value] ?? {}, null, JSON_INDENT),
      'application/json',
    )
  } catch (error) {
    reportFailure(error, { title: t('dms_lang.errors.export_failed') })
  }
}

function remove() {
  return removeLanguage(locale.value, () => router.push(links.overview()))
}

const shortcuts = useQueueShortcuts(
  {
    isActive: () => !!current.value,
    saveNext: () => void save(),
    save: saveInPlace,
    skip,
    previous: () => session.previous(),
  },
  { root: () => root.value, field: () => editor.value?.textareaRef },
)

function focusEditor() {
  const active = document.activeElement
  if (active && active !== document.body && !root.value?.contains(active))
    return
  editor.value?.textareaRef?.focus()
}

watch(
  () => current.value?.key,
  async (key) => {
    clearTimeout(urlTimer)
    if (exists.value && !isBase.value) {
      urlTimer = setTimeout(() => void session.syncUrl(key ?? ''), URL_SYNC_MS)
    }
    const shouldFocus = !shortcuts.isBrowsing()
    await nextTick()
    if (key && shouldFocus) focusEditor()
  },
)
watch([selectedWorkspace, locale], () => {
  armedSave.value = ''
})
// A key (or a language) deleted elsewhere while it held a draft: the draft
// goes with a toast that offers to copy it, so nothing asks to discard it
// later.
watch(
  [flat, isLoaded],
  () => {
    if (!isLoaded.value) return
    const keys = new Set(flat.value.rows.map((row) => row.key))
    const languages = new Set(flat.value.locales)
    const orphans = drafts.takeOrphans(
      (code, key) => languages.has(code) && keys.has(key),
    )
    for (const orphan of orphans) announceDeleted(orphan.key, orphan.value)
  },
  { immediate: true },
)

usePageHeaderActions(() => [
  h(UButton, {
    label: t('dms_lang.queue.open_matrix'),
    icon: 'i-ph-table',
    color: 'neutral',
    variant: 'outline',
    to: links.translations({
      missingIn: isBase.value ? undefined : locale.value,
      filter: isBase.value ? undefined : 'missing',
      namespace: namespace.value || undefined,
    }),
  }),
  exists.value
    ? h(UButton, {
        label: t('dms_lang.queue.download', { file: `${locale.value}.json` }),
        icon: 'i-ph-download-simple',
        color: 'neutral',
        variant: 'outline',
        onClick: download,
      })
    : null,
  canManage.value && allows('manageLanguages') && exists.value && !isBase.value
    ? h(
        UDropdownMenu,
        {
          items: [
            [
              {
                label: t('dms_lang.languages.make_base'),
                icon: 'i-ph-star',
                onSelect: () => makeBase(locale.value),
              },
              {
                label: t('dms_lang.languages.remove'),
                icon: 'i-ph-trash',
                color: 'error',
                onSelect: remove,
              },
            ],
          ],
          content: { align: 'end' },
        },
        () =>
          h(UButton, {
            icon: 'i-ph-dots-three',
            color: 'neutral',
            variant: 'outline',
            'aria-label': t('dms_lang.queue.more'),
          }),
      )
    : null,
])

onBeforeUnmount(() => clearTimeout(urlTimer))
</script>

<template>
  <template v-if="!isUnknown">
    <DmsCard v-if="!isLoaded" padded>
      <div class="space-y-4">
        <USkeleton class="h-5 w-1/3" />
        <USkeleton class="h-14 w-full" />
        <USkeleton class="h-24 w-full" />
      </div>
    </DmsCard>

    <DmsEmptyState
      v-else-if="!exists"
      :variant="locale ? 'no-result' : undefined"
      :icon="locale ? undefined : 'i-ph-translate'"
      size="lg"
      hatched
      :title="
        locale
          ? $t('dms_lang.queue.unknown_title', { code: locale })
          : $t('dms_lang.queue.pick_title')
      "
      :description="
        $t('dms_lang.queue.unknown_description', {
          workspace: selectedWorkspace,
        })
      "
      :actions="unknownActions"
    />

    <DmsEmptyState
      v-else-if="isBase"
      icon="i-ph-star"
      tone="primary"
      size="lg"
      hatched
      :title="$t('dms_lang.queue.base_title', { name: languageName })"
      :description="$t('dms_lang.queue.base_description')"
      :actions="[
        {
          label: $t('dms_lang.queue.open_matrix'),
          icon: 'i-ph-table',
          color: 'neutral',
          variant: 'outline',
          to: links.translations(),
        },
      ]"
    />

    <DmsCard v-else :padded="false">
      <div ref="root">
        <div class="border-default space-y-3 border-b px-4 py-3">
          <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
            <LocaleTile :code="locale" :siblings="flat.locales" />
            <div class="grid min-w-0 gap-px">
              <DmsEyebrow :label="$t('dms_lang.queue.title')" size="xs" />
              <span class="text-highlighted truncate text-base font-semibold">
                {{ languageName }}
                <span class="text-dimmed font-mono text-xs font-normal">
                  {{ locale }}
                </span>
              </span>
            </div>
            <UDropdownMenu
              :items="languageItems"
              :content="{ align: 'start' }"
              :ui="{ content: 'w-72' }"
            >
              <UButton
                icon="i-ph-caret-up-down"
                color="neutral"
                variant="ghost"
                size="xs"
                :aria-label="$t('dms_lang.queue.switch_language')"
              />
            </UDropdownMenu>
            <span class="text-muted ml-auto font-mono text-xs">
              {{ remainingLabel }}
            </span>
          </div>
          <div
            v-if="draftLinks.length"
            class="text-muted flex flex-wrap items-center gap-1.5 text-xs"
          >
            <UIcon name="i-ph-note-pencil" class="text-warning size-3.5" />
            <span>{{ $t('dms_lang.queue.drafts_elsewhere') }}</span>
            <UButton
              v-for="entry in draftLinks"
              :key="entry.id"
              size="xs"
              color="warning"
              variant="soft"
              :label="entry.label"
              :to="entry.to"
            />
          </div>
          <div class="flex flex-wrap items-center gap-3">
            <DmsMeter
              class="min-w-24 flex-1"
              :value="progress"
              :max="100"
              format="none"
              size="xs"
              tone="primary"
            />
            <UButton
              v-if="namespace"
              size="xs"
              color="primary"
              variant="soft"
              trailing-icon="i-ph-x"
              class="font-mono"
              :label="namespace"
              :aria-label="$t('dms_lang.queue.scope_clear', { namespace })"
              @click="namespace = ''"
            />
            <DmsSegmented v-model="mode" :items="modeItems" size="xs" />
          </div>
        </div>

        <DmsEmptyState
          v-if="isFinished || !current"
          icon="i-ph-check-circle"
          tone="success"
          size="lg"
          :title="doneTitle"
          :description="doneDescription"
          :actions="doneActions"
        />

        <template v-else>
          <div class="space-y-4 px-4 py-4">
            <div class="flex items-center gap-2">
              <UIcon name="i-ph-key" class="text-dimmed size-4" />
              <span class="font-mono text-xs break-all">
                <span class="text-dimmed">
                  {{ current.key.slice(0, current.key.lastIndexOf('.') + 1) }}
                </span>
                <span class="text-primary font-semibold">
                  {{ current.key.slice(current.key.lastIndexOf('.') + 1) }}
                </span>
              </span>
              <DmsStatusPill
                v-if="currentStatus"
                dot="none"
                size="sm"
                :tone="currentStatus === 'done' ? 'success' : 'neutral'"
                :label="$t(`dms_lang.queue.status_${currentStatus}`)"
              />
              <DmsStatusPill
                v-if="drafts.has(current.key)"
                dot="none"
                size="sm"
                tone="warning"
                :label="$t('dms_lang.queue.draft')"
              />
              <DmsStatusPill
                v-else-if="isOutdated"
                dot="none"
                size="sm"
                tone="warning"
                :label="$t('dms_lang.queue.status_outdated')"
              />
              <DmsStatusPill
                v-if="baseText.length > LONG_TEXT"
                dot="none"
                tone="neutral"
                size="sm"
                class="ml-auto"
                :label="$t('dms_lang.queue.long_text')"
              />
            </div>

            <div class="space-y-1.5">
              <div class="flex items-center gap-2 text-sm">
                <LocaleTile :code="baseLocale" size="sm" is-base />
                <span class="text-highlighted font-medium">
                  {{ nameOf(baseLocale) }}
                </span>
                <span class="text-dimmed text-xs">
                  {{ $t('dms_lang.common.base') }}
                </span>
              </div>
              <div
                class="border-default rounded-md border bg-(--dms-bg-muted) px-3.5 py-3 text-base"
              >
                <PlaceholderText
                  v-if="baseText"
                  :text="baseText"
                  class="text-highlighted"
                />
                <span v-else class="text-dimmed italic">
                  {{ $t('dms_lang.queue.no_base') }}
                </span>
              </div>
            </div>

            <div v-if="contextLocales.length" class="space-y-1">
              <DmsEyebrow :label="$t('dms_lang.queue.context')" size="xs" />
              <p
                v-for="code in contextLocales"
                :key="code"
                class="text-muted flex items-start gap-2 text-sm"
              >
                <LocaleTile :code="code" size="sm" />
                <span>{{ stringValue(current.values[code]) }}</span>
              </p>
            </div>

            <div class="space-y-1.5">
              <div class="flex items-center gap-2 text-sm">
                <LocaleTile :code="locale" size="sm" />
                <span class="text-highlighted font-medium">
                  {{ languageName }}
                </span>
                <span class="text-dimmed font-mono text-xs">{{ locale }}</span>
                <span
                  v-if="tokens.length && !issues.length"
                  class="ml-auto inline-flex items-center gap-1 text-xs"
                  :class="draft ? 'text-success' : 'text-dimmed'"
                >
                  <UIcon
                    :name="draft ? 'i-ph-check' : 'i-ph-brackets-curly'"
                    class="size-3.5"
                  />
                  {{
                    $t(draft ? 'dms_lang.queue.uses' : 'dms_lang.queue.needs', {
                      tokens: formatTokens(tokens),
                    })
                  }}
                </span>
              </div>

              <UAlert
                v-if="conflict !== undefined"
                color="warning"
                variant="subtle"
                icon="i-ph-warning"
                :title="
                  $t('dms_lang.queue.conflict_title', { key: current.key })
                "
                :description="
                  conflict
                    ? $t('dms_lang.queue.conflict_current', { value: conflict })
                    : $t('dms_lang.queue.conflict_empty')
                "
                :actions="[
                  {
                    label: $t('dms_lang.queue.conflict_use'),
                    color: 'warning',
                    variant: 'outline',
                    size: 'xs',
                    onClick: useTheirs,
                  },
                  {
                    label: $t('dms_lang.queue.conflict_overwrite'),
                    color: 'warning',
                    variant: 'solid',
                    size: 'xs',
                    disabled: isSaving,
                    onClick: overwrite,
                  },
                ]"
              />

              <UAlert
                v-if="isOutdated && canEditValues && !drafts.has(current.key)"
                color="warning"
                variant="subtle"
                icon="i-ph-clock-counter-clockwise"
                :description="$t('dms_lang.drawer.outdated')"
                :actions="[
                  {
                    label: $t('dms_lang.drawer.mark_reviewed'),
                    icon: 'i-ph-check',
                    color: 'warning',
                    variant: 'outline',
                    size: 'xs',
                    loading: isReviewing,
                    onClick: markReviewed,
                  },
                ]"
              />

              <UAlert
                v-if="!canEditValues"
                color="neutral"
                variant="subtle"
                icon="i-ph-lock-simple"
                :description="
                  isModules
                    ? $t('dms_lang.queue.read_only_modules')
                    : $t('dms_lang.queue.read_only')
                "
                :actions="
                  isModules
                    ? [
                        {
                          label: $t('dms_lang.queue.override'),
                          icon: 'i-ph-pencil-simple',
                          color: 'neutral',
                          variant: 'outline',
                          size: 'xs',
                          to: overrideLink,
                        },
                      ]
                    : []
                "
              />

              <UTextarea
                ref="editor"
                v-model="draft"
                :rows="3"
                autoresize
                :maxrows="12"
                autofocus
                class="w-full"
                :disabled="!canEditValues"
                :color="
                  isBlocked ? 'error' : issues.length ? 'warning' : 'primary'
                "
                :highlight="true"
                :placeholder="baseText"
                :ui="{ base: 'text-base' }"
              />

              <ul v-if="issues.length" class="space-y-0.5 text-xs">
                <li
                  v-for="issue in issues"
                  :key="issue.kind"
                  class="inline-flex w-full items-center gap-1"
                  :class="
                    issue.severity === 'error' ? 'text-error' : 'text-warning'
                  "
                >
                  <UIcon name="i-ph-warning" class="size-3.5 shrink-0" />
                  {{ messageIssueText(issue, t) }}
                </li>
              </ul>

              <ul
                v-if="rejectedProblems.length"
                class="text-error space-y-0.5 text-xs"
              >
                <li
                  v-for="problem in rejectedProblems"
                  :key="problem"
                  class="inline-flex w-full items-center gap-1"
                >
                  <UIcon name="i-ph-x-circle" class="size-3.5 shrink-0" />
                  {{ problem }}
                </li>
              </ul>

              <div
                v-if="canEditValues && (missingTokens.length || isBlocked)"
                class="flex flex-wrap gap-1.5"
              >
                <UButton
                  v-if="replacement"
                  size="xs"
                  color="warning"
                  variant="soft"
                  icon="i-ph-swap"
                  :label="
                    $t('dms_lang.queue.replace', {
                      from: formatTokens([replacement.from]),
                      to: formatTokens([replacement.to]),
                    })
                  "
                  @mousedown.prevent
                  @click="replaceToken(replacement.from, replacement.to)"
                />
                <UButton
                  v-for="token in missingTokens"
                  :key="token"
                  size="xs"
                  color="warning"
                  variant="soft"
                  :label="
                    $t('dms_lang.drawer.insert', {
                      token: formatTokens([token]),
                    })
                  "
                  @mousedown.prevent
                  @click="insertToken(token)"
                />
                <UButton
                  v-if="isBlocked && escapedDraft !== draft"
                  size="xs"
                  color="error"
                  variant="soft"
                  icon="i-ph-magic-wand"
                  :label="$t('dms_lang.queue.escape')"
                  @mousedown.prevent
                  @click="rewrite(escapedDraft)"
                />
              </div>

              <p
                v-if="isArmed && !isBlocked"
                class="text-warning text-xs font-medium"
              >
                {{ $t('dms_lang.queue.save_anyway_hint') }}
              </p>
            </div>
          </div>

          <div
            class="border-default flex flex-wrap items-center gap-2 border-t px-4 py-3"
          >
            <UButton
              icon="i-ph-arrow-left"
              color="neutral"
              variant="ghost"
              size="sm"
              :disabled="!canGoBack"
              @click="session.previous()"
            >
              {{ $t('dms_lang.queue.previous') }}
              <ShortcutKbds :keys="QUEUE_KEYS.previous" />
            </UButton>
            <div class="flex-1" />
            <UButton color="neutral" variant="outline" size="sm" @click="skip">
              {{ $t('dms_lang.queue.skip') }}
              <ShortcutKbds :keys="QUEUE_KEYS.skip" />
            </UButton>
            <UButton
              v-if="canEditValues"
              icon="i-ph-check"
              size="sm"
              :color="isArmed ? 'warning' : 'primary'"
              :loading="isSaving"
              @click="save()"
            >
              {{
                isArmed
                  ? $t('dms_lang.queue.save_anyway')
                  : $t('dms_lang.queue.save_next')
              }}
              <ShortcutKbds :keys="QUEUE_KEYS.saveNext" />
            </UButton>
          </div>
          <p class="text-dimmed px-4 pb-3 text-xs">
            <i18n-t
              keypath="dms_lang.queue.shortcuts_hint"
              scope="global"
              tag="span"
            >
              <template #leave>
                <ShortcutKbds :keys="QUEUE_KEYS.leaveField" />
              </template>
              <template #skip>
                <ShortcutKbds :keys="QUEUE_KEYS.skip" />
              </template>
              <template #previous>
                <ShortcutKbds :keys="QUEUE_KEYS.previous" />
              </template>
            </i18n-t>
          </p>

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
      </div>
    </DmsCard>
  </template>
</template>
