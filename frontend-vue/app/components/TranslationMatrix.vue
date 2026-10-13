<script setup lang="ts">
import type { ComponentPublicInstance } from 'vue'
import {
  useActiveElement,
  useElementSize,
  useIntersectionObserver,
} from '@vueuse/core'
import UButton from '@nuxt/ui/components/Button.vue'
import UDropdownMenu from '@nuxt/ui/components/DropdownMenu.vue'
import { useDmsRouter } from '#dms/frontend-module'
import type { FlatTranslationRow, LanguageCoverage } from '../types/lang'
import { useWorkspaceFlatSync } from '../composables/translation/useWorkspaceFlat'
import {
  coverageTone,
  languageCoverage,
  stringValue,
} from '../utils/translations'
import { exportFileName, translationsCsv } from '../utils/matrixExport'
import LocaleTile from '../build/components/LocaleTile.vue'
import PlaceholderText from '../build/components/PlaceholderText.vue'
import MatrixCell from '../build/components/matrix/MatrixCell.vue'
import MatrixColumns from '../build/components/matrix/MatrixColumns.vue'
import MatrixGroupHeader from '../build/components/matrix/MatrixGroupHeader.vue'
import MatrixKeyCell from '../build/components/matrix/MatrixKeyCell.vue'
import MatrixToolbar from '../build/components/matrix/MatrixToolbar.vue'
import ShortcutKbds from '../build/components/ShortcutKbds.vue'
import {
  useCellSaves,
  type CellAddress,
} from '../build/composables/useCellSaves'
import {
  useCellEditor,
  type CellRef,
} from '../build/composables/useCellEditor'
import {
  focusNeighbourCell,
  useCellMoves,
  type JumpStep,
} from '../build/composables/useCellMoves'
import { useKeyPanel } from '../build/composables/useKeyPanel'
import { useMatrixRows } from '../build/composables/useMatrixRows'
import { useMatrixView } from '../build/composables/useMatrixView'
import { useMatrixFilters } from '../build/composables/useMatrixFilters'
import { MATRIX_KEYS, shortcutName } from '../utils/shortcuts'

const COMPACT_WIDTH = 768
const OPEN_OVERLAY = '[role="dialog"][data-state="open"], [role="alertdialog"]'
const SCROLL_MARGIN = '400px'
const KEY_COLUMN_REM = 16
const LANGUAGE_COLUMN_REM = 15
const TODO_COLUMN_REM = 28
const SKELETON_ROWS = 6

const { t } = useI18n()
const { formatCount } = useLangFormat()
const { selectedWorkspace, editable: serverEditable } = useI18nWorkspaces()
const { flat, isLoaded, isLoading, hasError, reload } = useWorkspaceFlat()
useWorkspaceFlatSync()
const {
  current,
  isUnknown,
  isResolved,
  isDefault,
  isModules,
  canEditValues,
  canManage,
  canManageKeys,
} = useWorkspaceContext()
const { nameAmong, fullName } = useLocaleNames()
const { addKey } = useKeyActions()
const { addLanguage } = useLanguageActions()
const { route, pageAction, clearPageAction, selectWorkspace } =
  useWorkspaceRoute()
const router = useDmsRouter()
const toast = useToast()
const links = useLangLinks()
const { filters, order, saveOrder, sanitize, resetFilters } = useMatrixView()

const pinned = ref<Set<string>>(new Set())
const root = useTemplateRef<ComponentPublicInstance>('root')
const scroller = useTemplateRef<HTMLElement>('scroller')
const sentinel = useTemplateRef<HTMLElement>('sentinel')
const rootElement = computed<HTMLElement | undefined>(() => root.value?.$el)
const { width } = useElementSize(rootElement, {
  width: Number.POSITIVE_INFINITY,
  height: 0,
})
const isCompact = computed(() => width.value < COMPACT_WIDTH)

const rowsByKey = computed(
  () => new Map(flat.value.rows.map((row) => [row.key, row])),
)
const saves = useCellSaves(rowOf, (address) => {
  if (address.workspace === selectedWorkspace.value) pin(address.key)
})

const languages = computed<LanguageCoverage[]>(() =>
  languageCoverage(flat.value, (code) => nameAmong(code, flat.value.locales)),
)
const languageByCode = computed(
  () => new Map(languages.value.map((entry) => [entry.code, entry])),
)
const targetLanguages = computed(() =>
  languages.value
    .filter((entry) => !entry.isBase)
    .map((entry) => ({ code: entry.code, name: fullName(entry.code) })),
)
const todoLanguage = computed(() => {
  const chosen = filters.value.missingIn
  if (chosen && flat.value.locales.includes(chosen)) return chosen
  if (!isCompact.value) return ''
  const base = flat.value.defaultLocale
  return order.value.find((code) => code !== base) ?? ''
})
const columnCodes = computed(() => {
  if (!todoLanguage.value) return order.value
  const base = flat.value.defaultLocale
  return [base, todoLanguage.value].filter((code) =>
    flat.value.locales.includes(code),
  )
})
const columns = computed(() =>
  columnCodes.value
    .map((code) => languageByCode.value.get(code))
    .filter((entry): entry is LanguageCoverage => Boolean(entry)),
)
const columnSiblings = computed(() => columns.value.map((entry) => entry.code))
const compactColumn = computed(() => columns.value.at(-1))
const tableMinWidth = computed(() => {
  const column = todoLanguage.value ? TODO_COLUMN_REM : LANGUAGE_COLUMN_REM
  return `${KEY_COLUMN_REM + columns.value.length * column}rem`
})

const { rows, groups, counts, targets, namespaces, isRowDone } =
  useMatrixFilters(flat, filters, columnCodes, pinned)
const doneCount = computed(() => rows.value.filter(isRowFinished).length)
const rowCount = computed(() => rows.value.length)
const view = useMatrixRows(groups, rowCount)
const rowIndex = computed(
  () => new Map(view.renderedRows.value.map((row, index) => [row.key, index])),
)

const panel = useKeyPanel({
  keys: () => rows.value.map((row) => row.key),
  editable: () => canEditValues.value,
  manageKeys: () => canManageKeys.value,
  canOverride: () => isModules.value && serverEditable.value,
  isKnown: (key) => rowsByKey.value.has(key),
  onUnknown: (key) => void dropUnknownKey(key),
  onKeep: (holds) => saves.hold(holds),
  onOverride: (key) => {
    const row = rowsByKey.value.get(key)
    if (row) void overrideKey(row)
  },
})
const moves = useCellMoves({
  view,
  groups,
  columnCodes,
  targets,
  baseLocale: () => flat.value.defaultLocale,
  isPending: (key, code) => saves.isPending(at(key, code)),
})
const editor = useCellEditor({
  saves,
  panel,
  workspace: selectedWorkspace,
  baseLocale: () => flat.value.defaultLocale,
  locales: () => flat.value.locales,
  canEdit: () => canEditValues.value,
  shownValue,
  targetOf: moves.targetOf,
  onStart: pin,
  onMoveEnd: focusCell,
})

const countedLabel = computed(() =>
  targets.value.length === 1
    ? (languageByCode.value.get(targets.value[0])?.name ?? targets.value[0])
    : t(
        'dms_lang.matrix.languages_counted',
        { count: targets.value.length },
        targets.value.length,
      ),
)

useUnsavedChanges({
  dirty: () => saves.hasUnsaved.value || editor.hasOpenDraft.value,
})

function at(key: string, code: string): CellAddress {
  return { workspace: selectedWorkspace.value, key, code }
}

function rowOf(address: CellAddress): FlatTranslationRow | undefined {
  if (address.workspace !== selectedWorkspace.value) return undefined
  return rowsByKey.value.get(address.key)
}

function isRowFinished(row: FlatTranslationRow): boolean {
  return (
    isRowDone(row) && !saves.hasRowFailure(selectedWorkspace.value, row.key)
  )
}

function pin(key: string) {
  if (pinned.value.has(key)) return
  pinned.value = new Set([...pinned.value, key])
}

function rowValue(row: FlatTranslationRow | undefined, code: string): string {
  return row
    ? saves.shownValue(at(row.key, code), stringValue(row.values[code]))
    : ''
}

function shownValue(key: string, code: string): string {
  return rowValue(rowsByKey.value.get(key), code)
}

async function dropUnknownKey(key: string) {
  toast.add({
    title: t('dms_lang.matrix.key_not_found', { key }),
    description: t('dms_lang.matrix.key_not_found_description'),
    color: 'warning',
    icon: 'i-ph-magnifying-glass',
  })
  if (route.query.key !== key) return
  await router.replace(
    linkWithQuery(route.path, { ...route.query, key: undefined }),
  )
}

function jumpToMissing(step: JumpStep) {
  const target = moves.nextMissing(editor.cursor.value, step)
  if (!target) return
  view.reveal(target.key)
  editor.startEdit(target.key, target.code)
  nextTick(() =>
    rootElement.value
      ?.querySelector('[data-editing]')
      ?.scrollIntoView({ block: 'center', inline: 'nearest' }),
  )
}

const activeElement = useActiveElement()

function jumpUnlessOverlay(step: JumpStep) {
  return () => {
    if (document.querySelector(OPEN_OVERLAY) === null) jumpToMissing(step)
  }
}

defineShortcuts(
  computed(() =>
    canEditValues.value && !isFocusInsideOverlay(activeElement.value)
      ? {
          [shortcutName(MATRIX_KEYS.nextMissing)]: jumpUnlessOverlay(1),
          [shortcutName(MATRIX_KEYS.previousMissing)]: jumpUnlessOverlay(-1),
        }
      : {},
  ),
)

function focusCell(cell: CellRef) {
  const selector = `[data-matrix-cell][data-key="${CSS.escape(cell.key)}"][data-code="${CSS.escape(cell.code)}"]`
  nextTick(() =>
    rootElement.value?.querySelector<HTMLElement>(selector)?.focus(),
  )
}

function onGridKeydown(event: KeyboardEvent) {
  focusNeighbourCell(event, rootElement.value)
}

async function overrideKey(row: FlatTranslationRow) {
  panel.seedOverride(row)
  await selectWorkspace(DEFAULT_WORKSPACE, { query: { key: row.key } })
}

function inheritedOf(row: FlatTranslationRow, code: string) {
  if (!isDefault.value || !row.inherited) return undefined
  return stringValue(row.inherited[code]) || undefined
}

function cellProps(row: FlatTranslationRow, column: LanguageCoverage) {
  const { key } = row
  const { code } = column
  const isEditing = editor.isEditing(key, code)
  return {
    value: rowValue(row, code),
    baseValue: rowValue(row, flat.value.defaultLocale),
    inherited: inheritedOf(row, code),
    override: isModules.value ? row.overrides?.[code] : undefined,
    isBase: column.isBase,
    editable: canEditValues.value,
    isEditing,
    code,
    initialDraft: editor.initialDraftOf(key, code),
    state: saves.stateOf(at(key, code)),
    failure: saves.failureOf(at(key, code)),
    rowKey: key,
    languageName: column.name,
    isOutdated: row.outdated?.includes(code) ?? false,
    hasIssue: row.issues?.includes(code) ?? false,
    changedElsewhere: isEditing
      ? saves.changedElsewhere(at(key, code))
      : undefined,
  }
}

function discardCell(key: string, code: string) {
  saves.discard(at(key, code))
}

function reviewCell(key: string, code: string) {
  void saves.markReviewed(at(key, code))
}

function hideDone() {
  pinned.value = new Set()
}

function exportCsv(isView: boolean) {
  const base = flat.value.defaultLocale
  const ordered = isView
    ? columnCodes.value
    : [...new Set([...order.value, ...flat.value.locales])].filter((code) =>
        flat.value.locales.includes(code),
      )
  const locales = [base, ...ordered.filter((code) => code !== base)]
  const content = translationsCsv(
    isView ? rows.value : flat.value.rows,
    locales,
  )
  downloadText(
    exportFileName(selectedWorkspace.value, isView ? locales : undefined),
    content,
    'text/csv;charset=utf-8',
  )
}

function keysLabel(count: number): string {
  return t('dms_lang.matrix.group_keys', { count: formatCount(count) }, count)
}

function languagesLabel(count: number): string {
  return t('dms_lang.matrix.languages_counted', { count }, count)
}

usePageHeaderActions(
  () => [
  h(
    UDropdownMenu,
    {
      items: [
        {
          label: t('dms_lang.matrix.export_view', {
            keys: keysLabel(rows.value.length),
            languages: languagesLabel(columnCodes.value.length),
          }),
          icon: 'i-ph-funnel',
          onSelect: () => exportCsv(true),
        },
        {
          label: t('dms_lang.matrix.export_all', {
            keys: keysLabel(flat.value.rows.length),
            languages: languagesLabel(flat.value.locales.length),
          }),
          icon: 'i-ph-table',
          onSelect: () => exportCsv(false),
        },
      ],
      content: { align: 'end' },
    },
    () =>
      h(UButton, {
        label: t('dms_lang.matrix.export'),
        icon: 'i-ph-download-simple',
        trailingIcon: 'i-ph-caret-down',
        color: 'neutral',
        variant: 'outline',
        disabled: !isLoaded.value,
      }),
  ),
],
  { order: -1 },
)

watch(
  () => [filters.value, selectedWorkspace.value],
  () => {
    editor.commitEditing()
    pinned.value = new Set()
    view.reset()
  },
  { deep: true },
)

watch([namespaces, () => flat.value.locales.join(',')], () =>
  sanitize(namespaces.value),
)

watch(
  [pageAction, () => isResolved.value && isLoaded.value, isUnknown],
  async ([action, resolved, unknown]) => {
    if (action !== PAGE_ACTIONS.addKey || (!resolved && !unknown)) return
    await clearPageAction()
    if (resolved && canManageKeys.value) await addKey()
  },
  { immediate: true },
)

const endObserver = useIntersectionObserver(
  sentinel,
  (entries) => {
    if (entries.some((entry) => entry.isIntersecting)) view.showMore()
  },
  {
    root: () => (isCompact.value ? null : scroller.value),
    rootMargin: SCROLL_MARGIN,
  },
)

watch(
  () => view.renderedRows.value.length,
  () => {
    endObserver.pause()
    endObserver.resume()
  },
)

const matrixPath = route.path

onBeforeUnmount(() => {
  if (route.path === matrixPath) editor.leaveEditing()
})
</script>

<template>
  <DmsCard v-if="!isUnknown" ref="root" :padded="false" class="overflow-hidden">
    <MatrixToolbar
      v-model:filters="filters"
      :counts="counts"
      :languages="targetLanguages"
      :namespaces="namespaces"
      :counted-languages="targets.length"
      :shown-language="todoLanguage"
      :is-compact="isCompact"
    >
      <MatrixColumns
        v-if="!todoLanguage && !isCompact"
        :order="order"
        :languages="languages"
        :can-manage="canManage"
        :settings-link="links.workspaceSettings()"
        @update:order="saveOrder"
        @add="addLanguage()"
      />
    </MatrixToolbar>

    <div v-if="isModules" class="p-3">
      <DmsBanner
        tone="warning"
        size="sm"
        icon="i-ph-lock-simple"
        :title="$t('dms_lang.modules_notice.title')"
        :description="$t('dms_lang.modules_notice.override')"
      />
    </div>

    <div
      v-if="doneCount"
      class="border-default bg-success/5 flex flex-wrap items-center gap-2 border-b px-4 py-2 text-sm"
      role="status"
    >
      <UIcon name="i-ph-check-circle" class="text-success size-4" />
      <span class="text-default">
        {{
          $t(
            'dms_lang.matrix.done_banner',
            { count: formatCount(doneCount) },
            doneCount,
          )
        }}
      </span>
      <UButton
        size="xs"
        color="neutral"
        variant="outline"
        class="ml-auto"
        :label="$t('dms_lang.matrix.hide_done')"
        @click="hideDone"
      />
    </div>

    <DmsEmptyState
      v-if="hasError && !isLoaded"
      variant="error"
      size="lg"
      hatched
      :title="$t('dms_lang.errors.load_title', { name: current?.id ?? '' })"
      :description="$t('dms_lang.errors.load_description')"
      :actions="[
        {
          label: $t('dms_lang.actions.retry'),
          icon: 'i-ph-arrow-clockwise',
          color: 'neutral',
          variant: 'outline',
          loading: isLoading,
          onClick: () => reload(),
        },
      ]"
    />

    <div v-else-if="!isLoaded" class="divide-default divide-y">
      <div
        v-for="index in SKELETON_ROWS"
        :key="index"
        class="grid grid-cols-4 gap-4 px-4 py-4"
      >
        <USkeleton class="h-4 w-40" />
        <USkeleton class="h-4 w-full" />
        <USkeleton class="h-4 w-full" />
        <USkeleton class="h-4 w-3/4" />
      </div>
    </div>

    <DmsEmptyState
      v-else-if="!rows.length"
      :variant="flat.rows.length ? 'no-result' : 'no-data'"
      size="lg"
      hatched
      :title="
        flat.rows.length
          ? $t('dms_lang.matrix.no_match', { search: filters.search })
          : $t('dms_lang.matrix.no_keys')
      "
      :description="
        flat.rows.length
          ? $t(
              'dms_lang.matrix.no_match_description',
              { count: formatCount(flat.rows.length) },
              flat.rows.length,
            )
          : $t('dms_lang.matrix.no_keys_description')
      "
      :actions="[
        ...(flat.rows.length
          ? [
              {
                label: $t(
                  'dms_lang.matrix.show_all',
                  { count: formatCount(flat.rows.length) },
                  flat.rows.length,
                ),
                color: 'neutral',
                variant: 'outline',
                onClick: resetFilters,
              },
            ]
          : []),
        ...(canManageKeys
          ? [
              {
                label: filters.search
                  ? $t('dms_lang.matrix.add_named', { key: filters.search })
                  : $t('dms_lang.key_add.title'),
                icon: 'i-ph-plus',
                color: 'neutral',
                variant: 'ghost',
                onClick: () => addKey(),
              },
            ]
          : []),
      ]"
    />

    <div v-else-if="isCompact && compactColumn">
      <template v-for="group in view.rendered.value" :key="group.namespace">
        <div class="border-default border-b bg-(--dms-bg-muted) px-4 py-2">
          <MatrixGroupHeader
            :namespace="group.namespace"
            :keys="group.keys"
            :missing="group.missing"
            :collapsed="group.collapsed"
            @toggle="view.toggle(group.namespace)"
          />
        </div>
        <div
          v-for="row in group.shown"
          :key="row.key"
          class="border-default group/row space-y-2 border-b px-4 py-3"
          :data-editing="
            editor.isEditing(row.key, compactColumn.code) || undefined
          "
        >
          <MatrixKeyCell
            :row-key="row.key"
            :is-done="isRowFinished(row)"
            :is-modules="isModules"
            :is-overridden="row.overridden === true"
            :can-override="serverEditable"
            @open="editor.openKey(row.key, compactColumn.code)"
            @override="overrideKey(row)"
          />
          <p
            v-if="
              !compactColumn.isBase &&
              !editor.isEditing(row.key, compactColumn.code)
            "
            class="text-dimmed line-clamp-3 text-xs"
          >
            <PlaceholderText :text="rowValue(row, flat.defaultLocale)" />
          </p>
          <MatrixCell
            v-bind="cellProps(row, compactColumn)"
            @edit="editor.startEdit"
            @commit="editor.commitCell"
            @cancel="editor.cancelEdit"
            @retry="editor.retryCell"
            @discard="discardCell"
            @escape="editor.escapeFailure"
            @open-panel="editor.openFromCell"
            @review="reviewCell"
            @draft="editor.trackDraft"
          />
        </div>
      </template>
      <div v-if="view.hasMore.value" ref="sentinel" class="h-8" />
    </div>

    <div v-else ref="scroller" class="max-h-[70vh] overflow-auto">
      <table
        role="grid"
        :aria-rowcount="rows.length"
        class="w-full table-fixed border-separate border-spacing-0 text-sm"
        :style="{ minWidth: tableMinWidth }"
        @keydown="onGridKeydown"
      >
        <colgroup>
          <col class="w-44 sm:w-64" />
          <col
            v-for="column in columns"
            :key="column.code"
            :class="todoLanguage ? 'w-[28rem]' : 'w-60'"
          />
        </colgroup>
        <thead class="sticky top-0 z-20 bg-(--dms-surface-card)">
          <tr>
            <th
              class="border-default sticky left-0 z-10 border-r border-b bg-(--dms-surface-card) px-4 py-2.5 text-left shadow-[4px_0_6px_-4px_rgb(0_0_0/0.25)]"
            >
              <DmsEyebrow :label="$t('dms_lang.matrix.key')" size="xs" />
            </th>
            <th
              v-for="column in columns"
              :key="column.code"
              class="border-default border-b border-l px-3 pt-2.5 pb-0 text-left font-normal"
            >
              <div class="flex items-center gap-2">
                <LocaleTile
                  :code="column.code"
                  size="sm"
                  :is-base="column.isBase"
                  :siblings="columnSiblings"
                />
                <span class="text-highlighted truncate font-medium">
                  {{ column.name }}
                </span>
                <DmsStatusPill
                  v-if="column.isBase"
                  dot="none"
                  tone="neutral"
                  size="sm"
                  :label="$t('dms_lang.common.base')"
                />
                <span
                  v-else
                  class="text-dimmed ml-auto font-mono text-[10.5px] whitespace-nowrap"
                >
                  {{
                    $t(
                      'dms_lang.matrix.column_missing',
                      { count: formatCount(column.missing) },
                      column.missing,
                    )
                  }}
                </span>
              </div>
              <DmsMeter
                class="mt-2"
                :value="column.coverage"
                :max="100"
                size="xs"
                :tone="column.isBase ? 'primary' : coverageTone(column.coverage)"
              />
            </th>
          </tr>
        </thead>
        <tbody v-for="group in view.rendered.value" :key="group.namespace">
          <tr>
            <td
              :colspan="columns.length + 1"
              class="border-default border-b bg-(--dms-bg-muted) py-1.5"
            >
              <div class="sticky left-0 inline-block px-4">
                <MatrixGroupHeader
                  :namespace="group.namespace"
                  :keys="group.keys"
                  :missing="group.missing"
                  :collapsed="group.collapsed"
                  @toggle="view.toggle(group.namespace)"
                />
              </div>
            </td>
          </tr>
          <tr
            v-for="row in group.shown"
            :key="row.key"
            class="group/row align-top"
          >
            <td
              class="border-default group-hover/row:bg-elevated/30 sticky left-0 z-10 border-r border-b bg-(--dms-surface-card) px-4 py-2.5 shadow-[4px_0_6px_-4px_rgb(0_0_0/0.25)]"
            >
              <MatrixKeyCell
                :row-key="row.key"
                :is-done="isRowFinished(row)"
                :is-modules="isModules"
                :is-overridden="row.overridden === true"
                :can-override="serverEditable"
                @open="editor.openKey(row.key)"
                @override="overrideKey(row)"
              />
            </td>
            <td
              v-for="(column, columnIndex) in columns"
              :key="column.code"
              :data-row="rowIndex.get(row.key)"
              :data-col="columnIndex"
              :data-editing="editor.isEditing(row.key, column.code) || undefined"
              class="border-default group-hover/row:bg-elevated/30 border-b border-l px-1.5 py-1"
            >
              <MatrixCell
                v-bind="cellProps(row, column)"
                @edit="editor.startEdit"
                @commit="editor.commitCell"
                @cancel="editor.cancelEdit"
                @retry="editor.retryCell"
                @discard="discardCell"
                @escape="editor.escapeFailure"
                @open-panel="editor.openFromCell"
                @review="reviewCell"
                @draft="editor.trackDraft"
              />
            </td>
          </tr>
        </tbody>
      </table>
      <div v-if="view.hasMore.value" ref="sentinel" class="h-8" />
    </div>

    <div
      v-if="isLoaded"
      class="border-default text-dimmed flex flex-wrap items-center gap-x-4 gap-y-1 border-t px-4 py-2 text-xs"
    >
      <span>
        {{
          $t(
            'dms_lang.matrix.footer_keys',
            { count: formatCount(counts.missing) },
            counts.missing,
          )
        }}
        ·
        {{
          $t(
            'dms_lang.matrix.footer_cells',
            { count: formatCount(counts.cells), languages: countedLabel },
            counts.cells,
          )
        }}
      </span>
      <span
        v-if="canEditValues && !isCompact"
        class="ml-auto inline-flex flex-wrap items-center gap-3"
      >
        <span class="inline-flex items-center gap-1">
          <ShortcutKbds :keys="MATRIX_KEYS.saveDown" />
          {{ $t('dms_lang.matrix.shortcut_save_down') }}
        </span>
        <span class="inline-flex items-center gap-1">
          <ShortcutKbds :keys="MATRIX_KEYS.nextCell" />
          {{ $t('dms_lang.matrix.shortcut_next_cell') }}
        </span>
        <span class="inline-flex items-center gap-1">
          <ShortcutKbds :keys="MATRIX_KEYS.nextMissing" />
          /
          <ShortcutKbds :keys="MATRIX_KEYS.previousMissing" />
          {{ $t('dms_lang.matrix.shortcut_next_missing') }}
        </span>
        <span class="inline-flex items-center gap-1">
          <ShortcutKbds :keys="MATRIX_KEYS.openPanel" />
          {{ $t('dms_lang.matrix.open_panel') }}
        </span>
      </span>
    </div>
  </DmsCard>
</template>
