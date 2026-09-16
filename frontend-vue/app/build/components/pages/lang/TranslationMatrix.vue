<script setup lang="ts">
import type { DropdownMenuItem } from "@nuxt/ui";
import { useElementSize } from "@vueuse/core";

interface LocaleColumn {
  code: string;
  name: string;
  flag: string;
  isDefault: boolean;
}

interface MatrixRow {
  key: string;
  values: Record<string, string | undefined>;
  inherited?: Record<string, string | undefined>;
}

interface Props {
  rows: MatrixRow[];
  columns: LocaleColumn[];
  editable: boolean;
  showInherited: boolean;
  overridable: boolean;
  manageKeys: boolean;
  resetKey: string;
}

interface SavePayload {
  key: string;
  locale: string;
  value: string;
}

interface MatrixEmits {
  save: [payload: SavePayload];
  rename: [key: string];
  remove: [key: string];
  override: [key: string];
}

const props = defineProps<Props>();

const emit = defineEmits<MatrixEmits>();

const ROW_HEIGHT = 56;
const HEADER_HEIGHT = 44;
const KEY_WIDTH = 280;
const COLUMN_WIDTH = 240;
const OVERSCAN = 8;
const FALLBACK_VIEWPORT = 600;

const { t } = useI18n();

const scroller = ref<HTMLElement | null>(null);
const scrollTop = ref(0);
const { height: viewportHeight } = useElementSize(scroller);

function onScroll(event: Event) {
  scrollTop.value = (event.target as HTMLElement).scrollTop;
}

const totalRows = computed(() => props.rows.length);
const bodyHeight = computed(() => totalRows.value * ROW_HEIGHT);
const contentWidth = computed(
  () => KEY_WIDTH + props.columns.length * COLUMN_WIDTH,
);
const gridTemplate = computed(
  () => `${KEY_WIDTH}px repeat(${props.columns.length}, ${COLUMN_WIDTH}px)`,
);

const startIndex = computed(() =>
  Math.max(
    0,
    Math.floor((scrollTop.value - HEADER_HEIGHT) / ROW_HEIGHT) - OVERSCAN,
  ),
);

const endIndex = computed(() =>
  Math.min(
    totalRows.value,
    Math.ceil(
      (scrollTop.value - HEADER_HEIGHT + (viewportHeight.value || FALLBACK_VIEWPORT)) /
        ROW_HEIGHT,
    ) + OVERSCAN,
  ),
);

const visibleRows = computed(() =>
  props.rows.slice(startIndex.value, endIndex.value).map((row, offset) => ({
    row,
    top: (startIndex.value + offset) * ROW_HEIGHT,
  })),
);

const drafts = ref<Record<string, Record<string, string>>>({});

function stringValue(value: string | undefined): string {
  return value == null ? "" : String(value);
}

function buildDrafts(preserve: boolean) {
  const next: Record<string, Record<string, string>> = preserve
    ? { ...drafts.value }
    : {};
  for (const row of props.rows) {
    if (!next[row.key]) next[row.key] = {};
    for (const column of props.columns) {
      if (!preserve || next[row.key][column.code] === undefined) {
        next[row.key][column.code] = stringValue(row.values[column.code]);
      }
    }
  }
  drafts.value = next;
}

watch(
  () => [props.resetKey, props.rows, props.columns] as const,
  (now, prev) => {
    const contextChanged = !prev || now[0] !== prev[0];
    buildDrafts(!contextChanged);
    if (contextChanged) {
      if (scroller.value) scroller.value.scrollTop = 0;
      scrollTop.value = 0;
    }
  },
  { immediate: true },
);

function isMissing(row: MatrixRow, code: string): boolean {
  return stringValue(row.values[code]) === "";
}

function placeholderFor(row: MatrixRow, code: string): string {
  if (props.showInherited && row.inherited) {
    return stringValue(row.inherited[code]) || "—";
  }
  return "—";
}

function commit(key: string, code: string) {
  const next = drafts.value[key]?.[code] ?? "";
  const row = props.rows.find((item) => item.key === key);
  if (!row) return;
  if (next === stringValue(row.values[code])) return;
  emit("save", { key, locale: code, value: next });
}

function rowMenu(key: string): DropdownMenuItem[][] {
  const items: DropdownMenuItem[] = [];
  if (props.overridable) {
    items.push({
      label: t("dms_lang.translation.ws_override"),
      icon: "i-lucide-git-fork",
      onSelect: () => emit("override", key),
    });
  }
  if (props.manageKeys) {
    items.push({
      label: t("dms_lang.translation.ws_rename_key"),
      icon: "i-lucide-pencil",
      onSelect: () => emit("rename", key),
    });
    items.push({
      label: t("dms_lang.translation.ws_delete_key_title"),
      icon: "i-lucide-trash-2",
      color: "error",
      onSelect: () => emit("remove", key),
    });
  }
  return [items];
}
</script>

<template>
  <div
    v-if="props.rows.length === 0"
    class="text-muted py-12 text-center text-sm"
  >
    {{ $t("dms_lang.editor.no_keys") }}
  </div>

  <div
    v-else
    ref="scroller"
    class="relative max-h-[68vh] overflow-auto"
    @scroll="onScroll"
  >
    <div :style="{ minWidth: `${contentWidth}px` }">
      <div
        class="border-default sticky top-0 z-20 grid border-b bg-(--dms-surface-card)"
        :style="{ gridTemplateColumns: gridTemplate, height: `${HEADER_HEIGHT}px` }"
      >
        <div
          class="text-muted sticky left-0 z-10 flex items-center px-3 text-xs font-semibold bg-(--dms-surface-card)"
        >
          {{ $t("dms_lang.editor.col_key") }}
        </div>
        <div
          v-for="column in props.columns"
          :key="column.code"
          class="text-muted flex items-center gap-2 px-3 text-xs font-semibold"
        >
          <UIcon
            :name="column.flag ? `flagpack:${column.flag}` : 'i-lucide-globe'"
            class="size-4 shrink-0"
          />
          <span class="truncate">{{ column.name }}</span>
          <UBadge
            v-if="column.isDefault"
            color="neutral"
            variant="subtle"
            size="sm"
          >
            {{ $t("dms_lang.editor.base") }}
          </UBadge>
        </div>
      </div>

      <div class="relative" :style="{ height: `${bodyHeight}px` }">
        <div
          v-for="item in visibleRows"
          :key="item.row.key"
          class="group border-default absolute right-0 left-0 grid border-b"
          :style="{
            top: `${item.top}px`,
            height: `${ROW_HEIGHT}px`,
            gridTemplateColumns: gridTemplate,
          }"
        >
          <div
            class="sticky left-0 z-10 flex items-center px-3 bg-(--dms-surface-card)"
          >
            <span
              class="text-primary line-clamp-2 w-full font-mono text-xs break-all"
              :title="item.row.key"
            >{{ item.row.key }}</span>
            <UDropdownMenu
              v-if="props.overridable || props.manageKeys"
              :items="rowMenu(item.row.key)"
              :content="{ align: 'end' }"
            >
              <UButton
                icon="i-lucide-ellipsis"
                color="neutral"
                variant="ghost"
                size="xs"
                class="absolute top-1/2 right-1 -translate-y-1/2 opacity-0 transition-opacity group-hover:opacity-100"
                :aria-label="$t('dms_lang.translation.ws_rename')"
              />
            </UDropdownMenu>
          </div>

          <div
            v-for="column in props.columns"
            :key="column.code"
            class="flex items-center px-2"
          >
            <input
              v-if="props.editable"
              v-model="drafts[item.row.key][column.code]"
              :placeholder="placeholderFor(item.row, column.code)"
              class="bg-default text-default focus:border-primary h-8 w-full rounded-md border px-2.5 text-sm transition-colors focus:outline-none"
              :class="
                isMissing(item.row, column.code)
                  ? 'border-warning/40 border-dashed'
                  : 'border-default'
              "
              @blur="commit(item.row.key, column.code)"
              @keydown.enter.prevent="commit(item.row.key, column.code)"
            >
            <div
              v-else
              class="truncate text-sm"
              :class="isMissing(item.row, column.code) ? 'text-muted' : 'text-default'"
              :title="item.row.values[column.code] || ''"
            >
              {{ item.row.values[column.code] || "—" }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
