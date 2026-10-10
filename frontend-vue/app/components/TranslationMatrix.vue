<script setup lang="ts">
import UButton from '@nuxt/ui/components/Button.vue'
import { useDmsRouter } from '#dms/frontend-module'
import type { FlatTranslationRow, LanguageCoverage } from '../types/lang'
import {
  coverageTone,
  isRowValueMissing,
  languageCoverage,
  stringValue,
} from '../utils/translations'
import KeyEditorDrawer from '../build/components/KeyEditorDrawer.vue'
import LocaleTile from '../build/components/LocaleTile.vue'
import MatrixCell, {
  type CellState,
} from '../build/components/matrix/MatrixCell.vue'
import MatrixColumns from '../build/components/matrix/MatrixColumns.vue'
import {
  groupRows,
  parseFilter,
  useMatrixFilters,
  type MatrixFilterState,
} from '../build/composables/useMatrixFilters'

const ROW_PAGE = 150
const SAVED_FLASH_MS = 1800
const CELL_SEPARATOR = '\u0000'
const ANY_LANGUAGE = '*'
const ALL_NAMESPACES = '*'
const BAR_CLASSES: Record<'success' | 'warning' | 'error', string> = {
  success: 'bg-success',
  warning: 'bg-warning',
  error: 'bg-error',
}

const { t } = useI18n()
const toast = useToast()
const overlay = useOverlay()
const { formatCount } = useLangFormat()
const {
  selectedWorkspace,
  upsertKey,
  editable: serverEditable,
} = useI18nWorkspaces()
const { flat, isLoaded, isLoading, hasError, reload, update, load } =
  useWorkspaceFlat()
const { current, isDefault, isModules, canEditValues, canManage } =
  useWorkspaceContext()
const { nativeName } = useLocaleNames()
const { addKey } = useKeyActions()
const { addLanguage, removeLanguage } = useLanguageActions()
const { downloadFile } = useWorkspaceActions()
const { reportFailure } = useMutationToast()
const { route, pageAction, clearPageAction, switchLink } = useWorkspaceRoute()
const router = useDmsRouter()

const filters = ref<MatrixFilterState>({
  filter: parseFilter(route.query.filter),
  missingIn: route.query.missingIn ?? '',
  namespace: route.query.namespace ?? '',
  search: route.query.q ?? '',
})
const order = ref<string[]>([])
const collapsed = ref<Set<string>>(new Set())
const rowLimit = ref(ROW_PAGE)
const editingCell = ref<string | null>(null)
const cellStates = ref<Record<string, CellState>>({})
const failedDrafts = ref<Record<string, string>>({})

const { rows, counts, namespaces, isRowMissing } = useMatrixFilters(
  flat,
  filters,
)

const canManageKeys = computed(() => canEditValues.value)
const languages = computed<LanguageCoverage[]>(() =>
  languageCoverage(flat.value, nativeName),
)
const languageByCode = computed(
  () => new Map(languages.value.map((entry) => [entry.code, entry])),
)
const columns = computed(() =>
  order.value
    .map((code) => languageByCode.value.get(code))
    .filter((entry): entry is LanguageCoverage => Boolean(entry)),
)
const visibleRows = computed(() => rows.value.slice(0, rowLimit.value))
const groups = computed(() => groupRows(visibleRows.value, isRowMissing))
const missingTotal = computed(() => counts.value.missing)

const filterItems = computed(() => [
  {
    label: t('dms_lang.matrix.filter_all', {
      count: formatCount(counts.value.all),
    }),
    value: 'all',
  },
  {
    label: t('dms_lang.matrix.filter_missing', {
      count: formatCount(counts.value.missing),
    }),
    value: 'missing',
  },
  {
    label: t('dms_lang.matrix.filter_complete', {
      count: formatCount(counts.value.complete),
    }),
    value: 'complete',
  },
  {
    label: t('dms_lang.matrix.filter_issues', {
      count: formatCount(counts.value.issues),
    }),
    value: 'issues',
  },
])
const missingInItems = computed(() => [
  { label: t('dms_lang.matrix.any_language'), value: ANY_LANGUAGE },
  ...languages.value
    .filter((entry) => !entry.isBase)
    .map((entry) => ({ label: entry.name, value: entry.code })),
])
const namespaceItems = computed(() => [
  {
    label: t('dms_lang.matrix.all_namespaces', {
      count: namespaces.value.length,
    }),
    value: ALL_NAMESPACES,
  },
  ...namespaces.value.map((namespace) => ({
    label: namespace,
    value: namespace,
  })),
])
const missingInModel = computed({
  get: () => filters.value.missingIn || ANY_LANGUAGE,
  set: (value: string) =>
    (filters.value.missingIn = value === ANY_LANGUAGE ? '' : value),
})
const namespaceModel = computed({
  get: () => filters.value.namespace || ALL_NAMESPACES,
  set: (value: string) =>
    (filters.value.namespace = value === ALL_NAMESPACES ? '' : value),
})

function initialOrder(codes: string[]): string[] {
  const base = flat.value.defaultLocale
  const sorted = [...codes].sort((a, b) =>
    a === base ? -1 : b === base ? 1 : 0,
  )
  const focus = route.query.locale
  if (focus && codes.includes(focus) && focus !== base) {
    return codes.includes(base) ? [base, focus] : [focus]
  }
  return sorted
}

function bringForward(code: string) {
  const base = flat.value.defaultLocale
  if (!code || code === base || !flat.value.locales.includes(code)) return
  const rest = order.value.filter((entry) => entry !== code && entry !== base)
  const head = order.value.includes(base) ? [base] : []
  order.value = [...head, code, ...rest]
}

watch(
  () => filters.value.missingIn,
  (code) => bringForward(code),
)

watch(
  () => flat.value.locales.join(','),
  () => {
    const codes = flat.value.locales
    const kept = order.value.filter((code) => codes.includes(code))
    const added = codes.filter((code) => !order.value.includes(code))
    order.value = kept.length ? [...kept, ...added] : initialOrder(codes)
    if (!kept.length) bringForward(filters.value.missingIn)
  },
  { immediate: true },
)

watch(
  () => [
    filters.value.filter,
    filters.value.missingIn,
    filters.value.namespace,
    filters.value.search,
    selectedWorkspace.value,
  ],
  () => {
    rowLimit.value = ROW_PAGE
    editingCell.value = null
  },
)

function cellId(key: string, code: string): string {
  return `${key}${CELL_SEPARATOR}${code}`
}

function toggleGroup(namespace: string) {
  const next = new Set(collapsed.value)
  if (next.has(namespace)) next.delete(namespace)
  else next.add(namespace)
  collapsed.value = next
}

function setCellState(id: string, state: CellState) {
  cellStates.value = { ...cellStates.value, [id]: state }
}

function flashSaved(id: string) {
  setCellState(id, 'saved')
  setTimeout(() => {
    if (cellStates.value[id] === 'saved') setCellState(id, 'idle')
  }, SAVED_FLASH_MS)
}

function applyValue(key: string, code: string, value: string) {
  update(selectedWorkspace.value, (next) => {
    const target = next.rows.find((entry) => entry.key === key)
    if (target) target.values[code] = value === '' ? undefined : value
  })
}

async function saveCell(row: FlatTranslationRow, code: string, value: string) {
  const id = cellId(row.key, code)
  const workspace = selectedWorkspace.value
  editingCell.value = null
  setCellState(id, 'saving')
  try {
    await upsertKey(
      workspace,
      row.key,
      { [code]: value },
      flat.value.defaultLocale,
    )
    const { [id]: _done, ...rest } = failedDrafts.value
    failedDrafts.value = rest
    applyValue(row.key, code, value)
    flashSaved(id)
  } catch (error) {
    failedDrafts.value = { ...failedDrafts.value, [id]: value }
    setCellState(id, 'error')
    reportFailure(error, {
      title: t('dms_lang.matrix.save_failed', { key: row.key, code }),
      retry: () => saveCell(row, code, value),
    })
  }
}

function nextCell(row: FlatTranslationRow, code: string) {
  const editable = columns.value.filter(
    (column) => !column.isBase || isDefault.value,
  )
  const index = editable.findIndex((column) => column.code === code)
  const next = editable[index + 1]
  if (next) editingCell.value = cellId(row.key, next.code)
}

function editNextMissing() {
  const targets = columns.value.filter((column) => !column.isBase)
  for (const row of visibleRows.value) {
    const column = targets.find((entry) => isRowValueMissing(row, entry.code))
    if (column) {
      editingCell.value = cellId(row.key, column.code)
      return
    }
  }
}

async function openKey(key: string, seed?: FlatTranslationRow) {
  const keys = rows.value.map((row) => row.key)
  const index = keys.indexOf(key)
  const drawer = overlay.create(KeyEditorDrawer, {
    props: {
      keys: index < 0 ? [key] : keys,
      startIndex: Math.max(index, 0),
      editable: canEditValues.value,
      manageKeys: canManageKeys.value,
      seed,
    },
  })
  await drawer.open()
}

async function overrideKey(row: FlatTranslationRow) {
  await router.replace(switchLink('default'))
  await load()
  toast.add({
    title: t('dms_lang.override.switched'),
    description: t('dms_lang.override.switched_description', { key: row.key }),
    color: 'info',
    icon: 'i-ph-git-fork',
  })
  await openKey(row.key, { key: row.key, values: {}, inherited: row.values })
}

function csvCell(value: unknown): string {
  return `"${stringValue(value).replaceAll('"', '""')}"`
}

function exportCsv() {
  const locales = flat.value.locales
  const lines = [
    ['key', ...locales].map(csvCell).join(','),
    ...flat.value.rows.map((row) =>
      [row.key, ...locales.map((code) => row.values[code])]
        .map(csvCell)
        .join(','),
    ),
  ]
  downloadFile(`${selectedWorkspace.value}.csv`, lines.join('\n'), 'text/csv')
}

function onKeydown(event: KeyboardEvent) {
  const target = event.target as HTMLElement
  if (target.closest('input, textarea, [contenteditable]')) return
  if (event.key === 'n' && canEditValues.value) {
    event.preventDefault()
    editNextMissing()
  }
}

usePageHeaderActions(() => [
  h(UButton, {
    label: t('dms_lang.matrix.export'),
    icon: 'i-ph-download-simple',
    color: 'neutral',
    variant: 'outline',
    disabled: !isLoaded.value,
    onClick: exportCsv,
  }),
  canManageKeys.value
    ? h(UButton, {
        label: t('dms_lang.key_add.title'),
        icon: 'i-ph-plus',
        onClick: () => addKey(),
      })
    : null,
])

watch(
  [pageAction, isLoaded],
  async ([action, loaded]) => {
    if (action !== PAGE_ACTIONS.addKey || !loaded) return
    await clearPageAction()
    if (canManageKeys.value) await addKey()
  },
  { immediate: true },
)

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <DmsCard :padded="false" class="overflow-hidden">
    <div class="border-default flex flex-wrap items-center gap-2 border-b p-3">
      <DmsSegmented
        v-model="filters.filter"
        :items="filterItems"
        size="sm"
        :aria-label="$t('dms_lang.matrix.filter_label')"
      />
      <USelect
        v-model="missingInModel"
        :items="missingInItems"
        size="sm"
        class="w-48"
        icon="i-ph-warning"
        :aria-label="$t('dms_lang.matrix.missing_in')"
      />
      <USelect
        v-model="namespaceModel"
        :items="namespaceItems"
        size="sm"
        class="w-44"
        icon="i-ph-folder-simple"
        :aria-label="$t('dms_lang.matrix.namespace')"
      />
      <UInput
        v-model="filters.search"
        icon="i-ph-magnifying-glass"
        size="sm"
        class="min-w-48 flex-1"
        :placeholder="$t('dms_lang.matrix.search')"
      />
      <MatrixColumns
        v-model:order="order"
        :languages="languages"
        :can-manage="canManage"
        @add="addLanguage()"
        @remove="removeLanguage"
      />
    </div>

    <div v-if="isModules" class="p-3">
      <DmsBanner
        tone="warning"
        size="sm"
        icon="i-ph-lock-simple"
        :title="$t('dms_lang.modules_notice.title')"
        :description="$t('dms_lang.modules_notice.override')"
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
        v-for="index in 6"
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
          ? $t('dms_lang.matrix.no_match_description', { count: counts.all })
          : $t('dms_lang.matrix.no_keys_description')
      "
      :actions="[
        ...(flat.rows.length && filters.filter !== 'all'
          ? [
              {
                label: $t('dms_lang.matrix.show_all', { count: counts.all }),
                color: 'neutral',
                variant: 'outline',
                onClick: () => (filters.filter = 'all'),
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

    <div v-else class="max-h-[70vh] overflow-auto">
      <table
        class="w-full min-w-max table-fixed border-separate border-spacing-0 text-sm"
      >
        <colgroup>
          <col class="w-44 sm:w-64" />
          <col v-for="column in columns" :key="column.code" class="w-60" />
        </colgroup>
        <thead class="bg-(--dms-surface-card) sticky top-0 z-20">
          <tr>
            <th
              class="border-default bg-(--dms-surface-card) sticky left-0 z-10 border-b px-4 py-2.5 text-left"
            >
              <DmsEyebrow :label="$t('dms_lang.matrix.key')" size="xs" />
            </th>
            <th
              v-for="column in columns"
              :key="column.code"
              class="border-default border-b border-l px-3 pb-0 pt-2.5 text-left font-normal"
            >
              <div class="flex items-center gap-2">
                <LocaleTile
                  :code="column.code"
                  size="sm"
                  :is-base="column.isBase"
                />
                <span class="text-highlighted truncate font-medium">
                  {{ column.name }}
                </span>
                <DmsStatusPill
                  dot="none"
                  v-if="column.isBase"
                  tone="neutral"
                  size="sm"
                  :label="$t('dms_lang.common.base')"
                />
                <span
                  v-else
                  class="text-dimmed ml-auto whitespace-nowrap font-mono text-[10.5px]"
                >
                  {{
                    $t('dms_lang.matrix.column_missing', {
                      count: formatCount(column.missing),
                    })
                  }}
                </span>
              </div>
              <div
                class="bg-elevated mt-2 h-0.5 w-full overflow-hidden rounded-full"
              >
                <div
                  class="h-full rounded-full"
                  :class="
                    column.isBase
                      ? 'bg-primary'
                      : BAR_CLASSES[coverageTone(column.coverage)]
                  "
                  :style="{ width: `${column.coverage}%` }"
                />
              </div>
            </th>
          </tr>
        </thead>
        <tbody v-for="group in groups" :key="group.namespace">
          <tr>
            <td
              :colspan="columns.length + 1"
              class="border-default bg-(--dms-bg-muted) border-b px-4 py-1.5"
            >
              <button
                type="button"
                class="flex items-center gap-2"
                :aria-expanded="!collapsed.has(group.namespace)"
                @click="toggleGroup(group.namespace)"
              >
                <UIcon
                  name="i-ph-caret-down"
                  class="text-dimmed size-3.5 transition-transform"
                  :class="
                    collapsed.has(group.namespace) ? '-rotate-90' : undefined
                  "
                />
                <span
                  class="text-highlighted font-mono text-xs font-semibold uppercase"
                >
                  {{ group.namespace }}
                </span>
                <span class="text-dimmed font-mono text-[10.5px]">
                  {{
                    $t('dms_lang.matrix.group_keys', {
                      count: formatCount(group.keys),
                    })
                  }}
                </span>
                <DmsStatusPill
                  dot="none"
                  v-if="group.missing"
                  tone="warning"
                  size="sm"
                  :label="
                    $t('dms_lang.matrix.group_missing', {
                      count: formatCount(group.missing),
                    })
                  "
                />
              </button>
            </td>
          </tr>
          <template v-if="!collapsed.has(group.namespace)">
            <tr
              v-for="row in group.rows"
              :key="row.key"
              class="group/row align-top"
            >
              <td
                class="border-default group-hover/row:bg-elevated/30 bg-(--dms-surface-card) sticky left-0 z-10 border-b px-4 py-2.5"
              >
                <button
                  type="button"
                  class="hover:text-primary block w-full break-all text-left font-mono text-xs"
                  :title="$t('dms_lang.matrix.open_key')"
                  @click="openKey(row.key)"
                >
                  <span class="text-dimmed">
                    {{ row.key.slice(0, row.key.lastIndexOf('.') + 1) }}
                  </span>
                  <span class="text-primary font-semibold">
                    {{ row.key.slice(row.key.lastIndexOf('.') + 1) }}
                  </span>
                </button>
                <div v-if="isModules" class="mt-1.5">
                  <DmsStatusPill
                    dot="none"
                    v-if="row.overridden"
                    tone="success"
                    size="sm"
                    icon="i-ph-check"
                    :label="$t('dms_lang.override.overridden')"
                  />
                  <UButton
                    v-else-if="serverEditable"
                    size="xs"
                    color="neutral"
                    variant="outline"
                    icon="i-ph-git-fork"
                    :label="$t('dms_lang.override.action')"
                    @click="overrideKey(row)"
                  />
                </div>
              </td>
              <td
                v-for="column in columns"
                :key="column.code"
                class="border-default group-hover/row:bg-elevated/30 border-b border-l px-1.5 py-1"
              >
                <MatrixCell
                  :value="stringValue(row.values[column.code])"
                  :base-value="stringValue(row.values[flat.defaultLocale])"
                  :inherited="
                    isDefault && row.inherited
                      ? stringValue(row.inherited[column.code])
                      : undefined
                  "
                  :is-base="column.isBase"
                  :editable="canEditValues"
                  :is-editing="editingCell === cellId(row.key, column.code)"
                  :state="cellStates[cellId(row.key, column.code)] ?? 'idle'"
                  :failed-draft="failedDrafts[cellId(row.key, column.code)]"
                  @edit="editingCell = cellId(row.key, column.code)"
                  @cancel="editingCell = null"
                  @save="(value: string) => saveCell(row, column.code, value)"
                  @retry="
                    saveCell(
                      row,
                      column.code,
                      failedDrafts[cellId(row.key, column.code)] ?? '',
                    )
                  "
                  @next="nextCell(row, column.code)"
                />
              </td>
            </tr>
          </template>
        </tbody>
      </table>
      <div v-if="rows.length > rowLimit" class="flex justify-center p-3">
        <UButton
          color="neutral"
          variant="outline"
          size="sm"
          :label="
            $t('dms_lang.matrix.show_more', {
              shown: formatCount(rowLimit),
              total: formatCount(rows.length),
            })
          "
          @click="rowLimit += ROW_PAGE"
        />
      </div>
    </div>

    <div
      v-if="isLoaded"
      class="border-default text-dimmed flex flex-wrap items-center gap-x-4 gap-y-1 border-t px-4 py-2 text-xs"
    >
      <span>
        {{
          $t('dms_lang.matrix.footer', {
            missing: formatCount(missingTotal),
            shown: columns.length,
            total: languages.length,
          })
        }}
      </span>
      <span
        v-if="canEditValues"
        class="ml-auto inline-flex flex-wrap items-center gap-3"
      >
        <span class="inline-flex items-center gap-1">
          <UKbd size="sm">↵</UKbd>
          {{ $t('dms_lang.matrix.shortcut_edit') }}
        </span>
        <span class="inline-flex items-center gap-1">
          <UKbd size="sm">Tab</UKbd>
          {{ $t('dms_lang.matrix.shortcut_next_cell') }}
        </span>
        <span class="inline-flex items-center gap-1">
          <UKbd size="sm">N</UKbd>
          {{ $t('dms_lang.matrix.shortcut_next_missing') }}
        </span>
      </span>
    </div>
  </DmsCard>
</template>
