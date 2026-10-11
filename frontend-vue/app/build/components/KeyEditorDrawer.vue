<script setup lang="ts">
import { useMediaQuery } from '@vueuse/core'
import type { FlatTranslationRow } from '../../types/lang'
import {
  storedText,
  type ExpectedText,
  type SaveState,
} from '../../utils/keySaves'
import type { CellHold } from '../composables/useCellSaves'
import {
  clearsBaseText,
  useEditStarts,
  useKeySaves,
  useSaveStates,
} from '../composables/useKeySaves'
import {
  checkMessage,
  escapeMessage,
  formatTokens,
  hasBlockingIssue,
  isLocaleValueMissing,
  messageIssueText,
  NAMESPACE_SEPARATOR,
  placeholdersOf,
  replacePlaceholder,
  stringValue,
  type MessageIssue,
} from '../../utils/translations'
import LocaleTile from './LocaleTile.vue'
import PlaceholderText from './PlaceholderText.vue'
import ShortcutKbds from './ShortcutKbds.vue'
import { KEY_PANEL_KEYS } from '../../utils/shortcuts'

interface Props {
  keys: string[]
  /** The workspace the panel reads and saves, frozen while a key shows. */
  workspace: string
  startIndex: number
  editable: boolean
  manageKeys: boolean
  /** A key the workspace does not hold yet (a module key being overridden). */
  seed?: FlatTranslationRow
  /** Language whose field gets the focus when a key opens. */
  focusLocale?: string
  /** Text typed elsewhere (a matrix cell) for the key that opens. */
  initialDrafts?: Record<string, string>
  open?: boolean
  /** A read-only module key can be overridden in the project files. */
  canOverride?: boolean
}

interface Emits {
  close: []
  'update:open': [open: boolean]
  navigate: [key: string]
  override: [key: string]
  /** Texts that could not be saved as the panel closed, handed to their cells. */
  keep: [holds: CellHold[]]
}

interface KnownInherited {
  key: string
  inherited: FlatTranslationRow['inherited']
}

type FieldStatus = 'missing' | 'inherited' | 'overridden' | 'outdated' | 'done'

const WIDE_SCREEN_QUERY = '(min-width: 1024px)'
const BASE_MISSING_LABEL = 'dms_lang.matrix.source_missing'
const FIELD_STATUS_LABELS: Record<FieldStatus, string> = {
  missing: 'dms_lang.matrix.missing',
  inherited: 'dms_lang.drawer.inherited',
  overridden: 'dms_lang.drawer.overridden',
  outdated: 'dms_lang.drawer.outdated',
  done: '',
}

const props = withDefaults(defineProps<Props>(), {
  seed: undefined,
  focusLocale: undefined,
  initialDrafts: undefined,
  open: true,
  canOverride: false,
})
const emit = defineEmits<Emits>()

const { t } = useI18n()
const toast = useToast()
const { flatOf } = useWorkspaceFlat()
const { nativeName } = useLocaleNames()
const { renameKey, deleteKey, revertToModule } = useKeyActions()
const { reportFailure } = useMutationToast()
const saves = useKeySaves()

const isOpen = ref(props.open)
const workspace = ref(props.workspace)
const flat = computed(() => flatOf(workspace.value))
const currentKey = ref(props.keys[props.startIndex] ?? '')
const drafts = ref<Record<string, string>>({})
const editStarts = useEditStarts()
const knownInherited = ref<KnownInherited | null>(null)
const fieldStates = ref<Record<string, SaveState>>({})
const fieldErrors = ref<Record<string, string>>({})
const blocked = ref<Record<string, boolean>>({})
const states = useSaveStates(fieldStates)
const isWide = useMediaQuery(WIDE_SCREEN_QUERY)
const body = useTemplateRef<HTMLElement>('body')
let isClosing = false
let queue: Promise<unknown> = Promise.resolve()

const key = computed(() => currentKey.value)
const position = computed(() => props.keys.indexOf(key.value))
const storedRow = computed(() =>
  flat.value.rows.find((entry) => entry.key === key.value),
)
const isStored = computed(() => storedRow.value !== undefined)
const row = computed<FlatTranslationRow>(
  () =>
    storedRow.value ??
    (props.seed?.key === key.value ? props.seed : undefined) ?? {
      key: key.value,
      values: {},
      inherited: knownInheritedOf(key.value),
    },
)
const base = computed(() => flat.value.defaultLocale)
const baseText = computed(() => draftOf(base.value))
const locales = computed(() => [
  base.value,
  ...flat.value.locales.filter((code) => code !== base.value),
])
const crumbs = computed(() =>
  key.value.split(NAMESPACE_SEPARATOR).slice(0, -1).join(' › '),
)
const changedCodes = computed(() => locales.value.filter(isChanged))
const missingCount = computed(
  () => locales.value.filter((code) => statusOf(code) === 'missing').length,
)
const issueCount = computed(
  () => locales.value.filter((code) => issuesOf(code).length > 0).length,
)
const hasInherited = computed(() =>
  Object.values(row.value.inherited ?? {}).some(
    (value) => !isLocaleValueMissing(value),
  ),
)
const pendingCount = computed(() => locales.value.filter(isWaiting).length)
const isBusy = computed(() =>
  Object.values(fieldStates.value).includes('saving'),
)

useUnsavedChanges({ dirty: () => changedCodes.value.length > 0 })

function ownOf(code: string): string {
  return isStored.value ? stringValue(row.value.values[code]) : ''
}

function inheritedOf(code: string): string {
  const inherited = row.value.inherited?.[code]
  if (!isLocaleValueMissing(inherited)) return stringValue(inherited)
  return isStored.value ? '' : stringValue(row.value.values[code])
}

function baselineOf(code: string): string {
  return ownOf(code) || inheritedOf(code)
}

function draftOf(code: string): string {
  return drafts.value[code] ?? baselineOf(code)
}

function isChanged(code: string): boolean {
  const draft = drafts.value[code]
  if (draft === undefined || draft === baselineOf(code)) return false
  return Boolean(draft.trim()) || Boolean(ownOf(code))
}

function storedOf(code: string): string | null {
  return ownOf(code) || null
}

function expectedOf(code: string): ExpectedText {
  return editStarts.has(code) ? editStarts.of(code) : storedOf(code)
}

function hasConflict(code: string): boolean {
  return (
    isChanged(code) &&
    editStarts.has(code) &&
    editStarts.of(code) !== storedOf(code)
  )
}

function isWaiting(code: string): boolean {
  return (
    hasConflict(code) ||
    fieldStates.value[code] === 'error' ||
    blocked.value[code] === true
  )
}

function saveStateOf(code: string): SaveState {
  return blocked.value[code] ? 'error' : states.stateOf(code)
}

function startEdit(code: string) {
  editStarts.begin(code, storedOf(code))
}

function statusOf(code: string): FieldStatus {
  if (!draftOf(code).trim()) return 'missing'
  if (isChanged(code)) return 'done'
  if (!ownOf(code) && inheritedOf(code)) return 'inherited'
  if (ownOf(code) && row.value.inherited?.[code]) return 'overridden'
  if (row.value.outdated?.includes(code)) return 'outdated'
  return 'done'
}

function issuesOf(code: string): MessageIssue[] {
  return checkMessage(code === base.value ? '' : baseText.value, draftOf(code))
}

function issueOfKind(code: string, kind: MessageIssue['kind']) {
  return issuesOf(code).find((issue) => issue.kind === kind)
}

function setFieldState(code: string, state: SaveState, error = '') {
  states.setState(code, state)
  fieldErrors.value = { ...fieldErrors.value, [code]: error }
  blocked.value = { ...blocked.value, [code]: false }
}

function block(code: string) {
  setFieldState(code, 'idle')
  blocked.value = { ...blocked.value, [code]: true }
}

function setDraft(code: string, value: string) {
  startEdit(code)
  drafts.value = { ...drafts.value, [code]: value }
  if (blocked.value[code]) setFieldState(code, 'idle')
}

function discardDraft(code: string) {
  const { [code]: _dropped, ...rest } = drafts.value
  drafts.value = rest
  editStarts.end(code)
  setFieldState(code, 'idle')
}

function overwrite(code: string) {
  editStarts.set(code, storedOf(code))
  save([code])
}

function fieldInput(code: string): HTMLTextAreaElement | null {
  return (
    body.value?.querySelector<HTMLTextAreaElement>(
      `[data-locale="${code}"] textarea`,
    ) ?? null
  )
}

async function focusField(code?: string, caret?: number) {
  if (!code) return
  await nextTick()
  const input = fieldInput(code)
  if (!input) return
  input.scrollIntoView({ block: 'nearest' })
  input.focus()
  if (caret !== undefined) input.setSelectionRange(caret, caret)
}

function insertAtCaret(code: string, token: string) {
  const input = fieldInput(code)
  const current = draftOf(code)
  const start = input?.selectionStart ?? current.length
  const end = input?.selectionEnd ?? current.length
  setDraft(code, `${current.slice(0, start)}${token}${current.slice(end)}`)
  focusField(code, start + token.length)
}

function rewrite(code: string, value: string) {
  setDraft(code, value)
  focusField(code)
}

function knownInheritedOf(path: string) {
  return knownInherited.value?.key === path
    ? knownInherited.value.inherited
    : undefined
}

function settle(codes: string[], values: Record<string, string>) {
  const rest = { ...drafts.value }
  for (const code of codes) {
    const isDone = rest[code] === values[code]
    if (isDone) delete rest[code]
    if (isDone) editStarts.end(code)
    else editStarts.set(code, storedText(values[code]))
    setFieldState(code, 'idle')
    states.flashSaved(code)
  }
  drafts.value = rest
}

function collect(codes: string[]) {
  const values: Record<string, string> = {}
  const expected: Record<string, ExpectedText> = {}
  for (const code of codes.filter(isChanged)) {
    if (hasConflict(code)) continue
    if (hasBlockingIssue(issuesOf(code))) {
      block(code)
      continue
    }
    values[code] = draftOf(code)
    expected[code] = expectedOf(code)
  }
  return { values, expected }
}

function isClearingBase(codes: string[]): boolean {
  const code = base.value
  const stored = inheritedOf(code) ? '' : ownOf(code)
  return (
    codes.includes(code) &&
    isChanged(code) &&
    clearsBaseText(code, base.value, draftOf(code), stored)
  )
}

async function confirmBaseClear(codes: string[]) {
  if (!isClearingBase(codes)) return
  if (!(await saves.confirmClearBase(key.value))) discardDraft(base.value)
}

async function persist(codes: string[]): Promise<boolean> {
  const path = key.value
  const target = workspace.value
  await confirmBaseClear(codes)
  if (key.value !== path) return false
  const { values, expected } = collect(codes)
  const sent = Object.keys(values)
  const isHeld = codes.some((code) => blocked.value[code] || hasConflict(code))
  if (!sent.length) return !isHeld
  sent.forEach((code) => setFieldState(code, 'saving'))
  const outcome = await saves.write({
    workspace: target,
    key: path,
    values,
    expected,
  })
  if (outcome.status === 'failed') {
    sent.forEach((code) => setFieldState(code, 'error', outcome.message))
    return false
  }
  if (key.value === path) settle(sent, values)
  return !isHeld
}

function save(codes: string[]): Promise<boolean> {
  const run = queue.then(() => persist(codes))
  queue = run.catch(() => undefined)
  return run
}

function onFieldBlur(code: string) {
  if (document.hasFocus() && isChanged(code)) save([code])
}

async function flush(): Promise<boolean> {
  await queue
  return save(changedCodes.value)
}

function takeDrafts(typed: Record<string, string> | undefined) {
  for (const code of Object.keys(typed ?? {})) startEdit(code)
  drafts.value = { ...drafts.value, ...typed }
}

function show(path: string) {
  workspace.value = props.workspace
  currentKey.value = path
  fieldStates.value = {}
  fieldErrors.value = {}
  blocked.value = {}
  drafts.value = {}
  editStarts.clear()
  if (path === props.keys[props.startIndex]) takeDrafts(props.initialDrafts)
  focusField(props.focusLocale)
}

async function go(step: number) {
  const next =
    props.keys[(position.value < 0 ? props.startIndex : position.value) + step]
  if (next === undefined) return
  if (!(await flush())) return
  show(next)
  emit('navigate', next)
}

async function saveAndNext() {
  if (!(await flush())) return
  if (position.value < props.keys.length - 1) go(1)
}

function finish() {
  isOpen.value = false
  emit('update:open', false)
  emit('close')
}

async function requestClose() {
  if (isClosing || !isOpen.value) return
  isClosing = true
  const isSaved = await flush()
  isClosing = false
  if (isSaved) finish()
}

function blockingText(code: string): string {
  return issuesOf(code)
    .filter((issue) => issue.severity === 'error')
    .map((issue) => messageIssueText(issue, t))
    .join(' ')
}

function holdOf(code: string): CellHold {
  const isConflict = hasConflict(code)
  const target = { workspace: workspace.value, key: key.value, code }
  const message = isConflict
    ? t('dms_lang.drawer.conflict')
    : fieldErrors.value[code] || blockingText(code)
  const expected = isConflict ? storedOf(code) : expectedOf(code)
  return { ...target, draft: draftOf(code), message, isConflict, expected }
}

async function closeFromOutside() {
  const isSaved = await flush()
  isOpen.value = false
  if (!isSaved) emit('keep', changedCodes.value.map(holdOf))
  emit('close')
}

function onToggle(open: boolean) {
  if (!open) requestClose()
}

function onDismissAttempt() {
  if (!isWide.value) requestClose()
}

function onEscape() {
  const panel = body.value?.closest('[role="dialog"]')
  if (isWide.value && !panel?.contains(document.activeElement)) return
  requestClose()
}

function onOpenAutoFocus(event: Event) {
  if (!props.focusLocale) return
  event.preventDefault()
  focusField(props.focusLocale)
}

async function rename() {
  if (!(await flush())) return
  const renamed = await renameKey(key.value)
  if (renamed) finish()
}

async function markReviewed(code: string) {
  const path = key.value
  const outcome = await saves.markReviewed(
    { workspace: workspace.value, key: path },
    code,
  )
  if (outcome.status === 'failed') return reportFailure(outcome.error)
  toast.add({
    title: t('dms_lang.drawer.reviewed', { code, key: path }),
    color: 'success',
    icon: 'i-ph-check',
  })
}

async function remove() {
  if (!(await flush())) return
  const isDone = hasInherited.value
    ? await revertToModule(key.value)
    : await deleteKey(key.value)
  if (isDone) finish()
}

function stayOnKey() {
  toast.add({
    title: t('dms_lang.drawer.stays_title', { key: key.value }),
    description: t('dms_lang.drawer.stays_description'),
    color: 'warning',
    icon: 'i-ph-warning',
  })
  const waiting = locales.value.find(isWaiting)
  if (waiting) fieldInput(waiting)?.scrollIntoView({ block: 'nearest' })
}

watch(
  () =>
    [props.keys[props.startIndex], props.initialDrafts, props.workspace] as const,
  async ([target, , next], _previous, onCleanup) => {
    if (target === undefined) return
    if (target === key.value && next === workspace.value) {
      takeDrafts(props.initialDrafts)
      return focusField(props.focusLocale)
    }
    let isSuperseded = false
    onCleanup(() => (isSuperseded = true))
    const isSaved = await flush()
    if (isSuperseded) return
    if (isSaved) show(target)
    else stayOnKey()
    emit('navigate', key.value)
  },
)

watch(
  () => props.focusLocale,
  (code) => focusField(code),
)

watch(
  storedRow,
  (stored) => {
    if (stored?.inherited && Object.keys(stored.inherited).length)
      knownInherited.value = { key: stored.key, inherited: stored.inherited }
  },
  { immediate: true },
)

watch(
  () => props.open,
  (open) => {
    if (open && !isOpen.value) {
      isOpen.value = true
      show(props.keys[props.startIndex] ?? key.value)
    } else if (!open && isOpen.value) closeFromOutside()
  },
)

onMounted(() => show(key.value))
</script>

<template>
  <USlideover
    :open="isOpen"
    :title="key"
    :modal="!isWide"
    :overlay="!isWide"
    :dismissible="false"
    :content="{
      onOpenAutoFocus,
      onEscapeKeyDown: onEscape,
    }"
    :ui="{ content: 'sm:max-w-xl', body: 'space-y-3' }"
    @update:open="onToggle"
    @close:prevent="onDismissAttempt"
  >
    <template #title>
      <span class="font-mono break-all">{{ key }}</span>
    </template>
    <template #description>
      <span class="block space-y-2">
        <DmsEyebrow
          as="span"
          :label="
            crumbs
              ? $t('dms_lang.drawer.eyebrow', { path: crumbs })
              : $t('dms_lang.drawer.key')
          "
          size="xs"
          truncate
        />
        <span class="flex flex-wrap items-center gap-1.5">
          <DmsStatusPill
            v-if="missingCount"
            dot="none"
            tone="warning"
            size="sm"
            :label="$t('dms_lang.drawer.missing', missingCount)"
          />
          <DmsStatusPill
            v-if="issueCount"
            dot="none"
            tone="error"
            size="sm"
            icon="i-ph-warning"
            :label="$t('dms_lang.drawer.issues', issueCount)"
          />
          <span
            v-if="placeholdersOf(baseText).length"
            class="text-dimmed inline-flex items-center gap-1.5 text-xs"
          >
            <UIcon name="i-ph-brackets-curly" class="size-3.5" />
            {{ $t('dms_lang.drawer.placeholders') }}
            <PlaceholderText :text="formatTokens(placeholdersOf(baseText))" />
          </span>
        </span>
      </span>
    </template>
    <template #actions>
      <UButton
        icon="i-ph-caret-up"
        color="neutral"
        variant="ghost"
        size="xs"
        :disabled="position <= 0"
        :aria-label="$t('dms_lang.drawer.previous')"
        @click="go(-1)"
      />
      <UButton
        icon="i-ph-caret-down"
        color="neutral"
        variant="ghost"
        size="xs"
        :disabled="position < 0 || position >= props.keys.length - 1"
        :aria-label="$t('dms_lang.drawer.next')"
        @click="go(1)"
      />
    </template>

    <template #body>
      <div ref="body" class="space-y-4">
        <div
          v-for="code in locales"
          :key="`${key}-${code}`"
          :data-locale="code"
          class="space-y-1.5"
        >
          <div class="flex items-center gap-2 text-sm">
            <LocaleTile :code="code" size="sm" :is-base="code === base" />
            <span class="text-highlighted font-medium">
              {{ nativeName(code) }}
            </span>
            <span class="text-dimmed font-mono text-xs">{{ code }}</span>
            <DmsStatusPill
              v-if="code === base"
              dot="none"
              tone="neutral"
              size="sm"
              :label="$t('dms_lang.common.base')"
            />
            <span class="ml-auto inline-flex items-center gap-1.5 text-xs">
              <span
                v-if="hasConflict(code)"
                class="text-error inline-flex items-center gap-1 font-medium"
              >
                <UIcon name="i-ph-warning" class="size-3.5" />
                {{ $t('dms_lang.drawer.conflict') }}
              </span>
              <template v-else-if="saveStateOf(code) !== 'idle'">
                <DmsSaveStatus
                  :state="saveStateOf(code)"
                  @retry="save([code])"
                />
                <UButton
                  v-if="saveStateOf(code) === 'error'"
                  size="xs"
                  color="neutral"
                  variant="link"
                  :label="$t('dms_lang.drawer.discard')"
                  @click="discardDraft(code)"
                />
              </template>
              <span
                v-else-if="statusOf(code) === 'missing'"
                class="text-warning font-mono font-semibold uppercase"
              >
                {{
                  $t(
                    code === base
                      ? BASE_MISSING_LABEL
                      : FIELD_STATUS_LABELS.missing,
                  )
                }}
              </span>
              <template v-else-if="statusOf(code) !== 'done'">
                <span
                  :class="
                    statusOf(code) === 'outdated'
                      ? 'text-warning font-medium'
                      : 'text-dimmed'
                  "
                >
                  {{ $t(FIELD_STATUS_LABELS[statusOf(code)]) }}
                </span>
                <UButton
                  v-if="statusOf(code) === 'overridden' && props.editable"
                  size="xs"
                  color="neutral"
                  variant="link"
                  :label="$t('dms_lang.drawer.use_module')"
                  @click="(setDraft(code, ''), save([code]))"
                />
                <UButton
                  v-else-if="statusOf(code) === 'outdated' && props.editable"
                  size="xs"
                  color="neutral"
                  variant="link"
                  icon="i-ph-check"
                  :label="$t('dms_lang.drawer.mark_reviewed')"
                  @click="markReviewed(code)"
                />
              </template>
              <UIcon
                v-else-if="code !== base && !issuesOf(code).length"
                name="i-ph-check"
                class="text-success size-4"
              />
            </span>
          </div>
          <UTextarea
            v-if="props.editable"
            :model-value="draftOf(code)"
            autoresize
            :rows="1"
            :maxrows="10"
            class="w-full"
            :color="issuesOf(code).length ? 'error' : undefined"
            :highlight="issuesOf(code).length > 0"
            @update:model-value="(value: string) => setDraft(code, value)"
            @blur="onFieldBlur(code)"
            @keydown.meta.enter.prevent="saveAndNext"
            @keydown.ctrl.enter.prevent="saveAndNext"
          />
          <div
            v-else
            class="border-default rounded-md border bg-(--dms-bg-muted) px-3 py-2 text-sm"
          >
            <PlaceholderText v-if="draftOf(code)" :text="draftOf(code)" />
            <span v-else class="text-dimmed">—</span>
            <p
              v-if="row.overrides?.[code]"
              class="text-dimmed border-default mt-2 border-t pt-2 text-xs"
            >
              {{ $t('dms_lang.drawer.project_value') }}
              <PlaceholderText
                :text="row.overrides[code]"
                class="text-default"
              />
            </p>
          </div>
          <div
            v-if="hasConflict(code)"
            class="border-error/40 space-y-1.5 rounded-md border px-3 py-2 text-xs"
          >
            <p class="text-dimmed">
              <template v-if="ownOf(code)">
                {{ $t('dms_lang.drawer.conflict_value') }}
                <PlaceholderText :text="ownOf(code)" class="text-default" />
              </template>
              <template v-else>
                {{ $t('dms_lang.drawer.conflict_empty') }}
              </template>
            </p>
            <p class="text-dimmed">{{ $t('dms_lang.drawer.conflict_help') }}</p>
            <div class="flex flex-wrap gap-1.5">
              <UButton
                size="xs"
                color="error"
                variant="soft"
                :label="$t('dms_lang.drawer.overwrite')"
                @mousedown.prevent
                @click="overwrite(code)"
              />
              <UButton
                size="xs"
                color="neutral"
                variant="outline"
                :label="$t('dms_lang.drawer.discard')"
                @mousedown.prevent
                @click="discardDraft(code)"
              />
            </div>
          </div>
          <p v-else-if="fieldErrors[code]" class="text-error text-xs">
            {{ fieldErrors[code] }}
          </p>
          <div
            v-if="props.editable && issuesOf(code).length"
            class="space-y-1 text-xs"
          >
            <div
              v-for="issue in issuesOf(code)"
              :key="issue.kind"
              class="flex flex-wrap items-center gap-x-3 gap-y-1"
            >
              <span
                :class="
                  issue.severity === 'error' ? 'text-error' : 'text-warning'
                "
              >
                {{ messageIssueText(issue, t) }}
                <template v-if="issue.kind === 'missing'">
                  {{
                    $t(
                      'dms_lang.drawer.issue_help',
                      { tokens: formatTokens(issue.tokens) },
                      issue.count,
                    )
                  }}
                </template>
              </span>
              <template v-if="issue.kind === 'missing'">
                <UButton
                  v-for="token in issue.tokens"
                  :key="token"
                  size="xs"
                  color="error"
                  variant="soft"
                  :label="
                    $t('dms_lang.drawer.insert', {
                      token: formatTokens([token]),
                    })
                  "
                  @mousedown.prevent
                  @click="insertAtCaret(code, formatTokens([token]))"
                />
                <UButton
                  v-if="
                    issue.tokens.length === 1 &&
                    issueOfKind(code, 'extra')?.tokens.length === 1
                  "
                  size="xs"
                  color="error"
                  variant="soft"
                  :label="
                    $t('dms_lang.message_issue.replace', {
                      token: formatTokens(issue.tokens),
                    })
                  "
                  @mousedown.prevent
                  @click="
                    rewrite(
                      code,
                      replacePlaceholder(
                        draftOf(code),
                        issueOfKind(code, 'extra')?.tokens[0] ?? '',
                        issue.tokens[0],
                      ),
                    )
                  "
                />
              </template>
              <UButton
                v-else-if="
                  issue.severity === 'error' &&
                  escapeMessage(draftOf(code)) !== draftOf(code)
                "
                size="xs"
                color="error"
                variant="soft"
                icon="i-ph-magic-wand"
                :label="$t('dms_lang.message_issue.escape')"
                @mousedown.prevent
                @click="rewrite(code, escapeMessage(draftOf(code)))"
              />
            </div>
          </div>
          <p
            v-else-if="
              props.editable &&
              code !== base &&
              baseText &&
              statusOf(code) === 'missing'
            "
            class="text-dimmed text-xs"
          >
            {{ $t('dms_lang.drawer.reference') }}
            <PlaceholderText :text="baseText" />
          </p>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="w-full space-y-2">
        <div
          v-if="props.editable"
          class="text-dimmed flex items-center justify-between gap-2 text-xs"
        >
          <span aria-live="polite">
            <template v-if="isBusy">
              {{ $t('dms_lang.drawer.saving') }}
            </template>
            <span v-else-if="pendingCount" class="text-error">
              {{ $t('dms_lang.drawer.unsaved_count', pendingCount) }}
            </span>
            <template v-else>{{ $t('dms_lang.drawer.autosave') }}</template>
          </span>
          <span class="hidden items-center gap-1 sm:inline-flex">
            <ShortcutKbds :keys="KEY_PANEL_KEYS.saveNext" />
            {{ $t('dms_lang.drawer.save_next') }}
          </span>
        </div>
        <div class="flex w-full items-center gap-2">
          <template v-if="props.manageKeys && isStored">
            <UButton
              v-if="!hasInherited"
              icon="i-ph-pencil-simple"
              color="neutral"
              variant="ghost"
              size="sm"
              :label="$t('dms_lang.drawer.rename')"
              @click="rename"
            />
            <UButton
              :icon="
                hasInherited ? 'i-ph-arrow-counter-clockwise' : 'i-ph-trash'
              "
              :color="hasInherited ? 'neutral' : 'error'"
              variant="ghost"
              size="sm"
              :label="
                hasInherited
                  ? $t('dms_lang.drawer.revert_module')
                  : $t('dms_lang.drawer.delete')
              "
              @click="remove"
            />
          </template>
          <UButton
            v-if="!props.editable && props.canOverride"
            icon="i-ph-git-fork"
            color="neutral"
            variant="outline"
            size="sm"
            :label="$t('dms_lang.override.action')"
            @click="emit('override', key)"
          />
          <div class="flex-1" />
          <UButton
            v-if="props.editable"
            icon="i-ph-check"
            size="sm"
            :loading="isBusy"
            :disabled="!changedCodes.length"
            :label="$t('dms_lang.drawer.save')"
            @click="flush()"
          />
        </div>
      </div>
    </template>
  </USlideover>
</template>
