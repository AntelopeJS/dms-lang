<script setup lang="ts">
import type { DropdownMenuItem } from "@nuxt/ui";
import type { WorkspaceLocale } from "../../composables/translation/useI18nWorkspaces";

interface LanguageCard {
  code: string;
  name: string;
  flag: string;
  coverage: number;
  missing: number;
  isDefault: boolean;
  isRtl: boolean;
}

interface KpiItem {
  key: string;
  title: string;
  icon: string;
  value: number;
  format: "number" | "compact" | "percent";
}

const TRANSLATIONS_PATH = "/modules/lang/translations";
const HIGH_COVERAGE = 90;
const MID_COVERAGE = 60;
const FULL_COVERAGE = 100;
const RTL_CODES = ["ar", "he", "fa", "ur", "ps", "sd", "ug", "yi", "dv"];

const { t } = useI18n();
const { confirm } = useConfirm();
const { localeMetaOf } = useLocaleMeta();
const { tryMutate } = useMutationToast();

const {
  editable: devEditable,
  selectedWorkspace,
  fetchWorkspaces,
  canUseWorkspaceId,
  renameWorkspace,
  deleteWorkspace,
  setDefaultLocale,
} = useI18nWorkspaces();

const { current, canManage } = useWorkspaceContext();

const { flat, isLoading, reload, removeLanguage } = useWorkspaceFlat();

function localeLabelOf(locale: WorkspaceLocale): string {
  return locale.name || localeMetaOf(locale.code).name;
}

function localeFlagOf(locale: WorkspaceLocale): string {
  return locale.flag || localeMetaOf(locale.code).flag;
}

const cards = computed<LanguageCard[]>(() => {
  const fallback = flat.value.defaultLocale;
  return (current.value?.locales ?? [])
    .map((locale) => ({
      code: locale.code,
      name: localeLabelOf(locale),
      flag: localeFlagOf(locale),
      coverage: flat.value.localeProgress[locale.code] ?? 0,
      missing: flat.value.localeMissing[locale.code] ?? 0,
      isDefault: locale.code === fallback,
      isRtl: RTL_CODES.includes(locale.code),
    }))
    .sort((a, b) => a.coverage - b.coverage);
});

const missingCount = computed(() =>
  cards.value
    .filter((card) => !card.isDefault)
    .reduce((sum, card) => sum + card.missing, 0),
);

const coverage = computed(() => {
  const targets = cards.value.filter((card) => !card.isDefault);
  return targets.length
    ? Math.round(
        targets.reduce((sum, card) => sum + card.coverage, 0) / targets.length,
      )
    : FULL_COVERAGE;
});

const kpis = computed<KpiItem[]>(() => [
  {
    key: "languages",
    title: t("dms_lang.overview.kpi_languages"),
    icon: "i-ph-globe",
    value: flat.value.locales.length,
    format: "number",
  },
  {
    key: "keys",
    title: t("dms_lang.overview.kpi_keys"),
    icon: "i-ph-list-bullets",
    value: flat.value.totalKeys,
    format: "compact",
  },
  {
    key: "missing",
    title: t("dms_lang.overview.kpi_missing"),
    icon: "i-ph-warning",
    value: missingCount.value,
    format: "number",
  },
  {
    key: "coverage",
    title: t("dms_lang.overview.kpi_coverage"),
    icon: "i-ph-chart-line-up",
    value: coverage.value,
    format: "percent",
  },
]);

const hasKeys = computed(() => flat.value.totalKeys > 0);

function coverageColor(progress: number): string {
  if (!hasKeys.value) return "neutral";
  if (progress >= HIGH_COVERAGE) return "success";
  if (progress >= MID_COVERAGE) return "warning";
  return "error";
}

function translateTarget(card: LanguageCard): string {
  return card.missing > 0
    ? `${TRANSLATIONS_PATH}?filter=missing&locale=${card.code}`
    : TRANSLATIONS_PATH;
}

const langAddOpen = ref(false);

async function makeDefault(code: string) {
  const ok = await tryMutate(() =>
    setDefaultLocale(selectedWorkspace.value, code),
  );
  if (!ok) return;
  await reload();
}

const wsRenameOpen = ref(false);
const wsRenameForm = ref({ id: "", newId: "" });

function openRenameWorkspace() {
  wsRenameForm.value = {
    id: selectedWorkspace.value,
    newId: selectedWorkspace.value,
  };
  wsRenameOpen.value = true;
}

const renamedId = computed(() =>
  normalizeWorkspaceId(wsRenameForm.value.newId),
);
const canRename = computed(() => canUseWorkspaceId(renamedId.value));

async function submitRenameWorkspace() {
  if (!canRename.value) return;
  const ok = await tryMutate(() =>
    renameWorkspace(wsRenameForm.value.id, renamedId.value),
  );
  if (!ok) return;
  wsRenameOpen.value = false;
  const list = await fetchWorkspaces();
  if (list.some((workspace) => workspace.id === renamedId.value)) {
    selectedWorkspace.value = renamedId.value;
  }
}

async function requestDeleteWorkspace() {
  const id = selectedWorkspace.value;
  const confirmed = await confirm({
    title: t("dms_lang.translation.ws_delete_workspace_title"),
    description: t("dms_lang.translation.ws_delete_workspace_confirm", {
      name: id,
    }),
    confirmLabel: t("dms_lang.translation.ws_delete"),
    confirmColor: "error",
  });
  if (!confirmed) return;
  const ok = await tryMutate(() => deleteWorkspace(id));
  if (!ok) return;
  await fetchWorkspaces();
}

const workspaceMenu = computed<DropdownMenuItem[][]>(() => [
  [
    {
      label: t("dms_lang.translation.ws_rename"),
      icon: "i-lucide-pencil",
      onSelect: openRenameWorkspace,
    },
    {
      label: t("dms_lang.translation.ws_delete"),
      icon: "i-lucide-trash-2",
      color: "error",
      onSelect: requestDeleteWorkspace,
    },
  ],
]);
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-center gap-3">
      <DmsLangWorkspaceStatus />

      <UDropdownMenu v-if="canManage" :items="workspaceMenu">
        <UButton
          icon="i-lucide-ellipsis"
          color="neutral"
          variant="ghost"
          size="sm"
          :aria-label="$t('dms_lang.translation.ws_actions')"
        />
      </UDropdownMenu>

      <div class="flex-1" />

      <UButton
        :to="TRANSLATIONS_PATH"
        icon="i-lucide-languages"
        color="neutral"
        variant="subtle"
        :label="$t('dms_lang.overview.open_editor')"
      />
      <UTooltip
        v-if="devEditable"
        :text="canManage ? undefined : $t('dms_lang.translation.ws_add_language_locked')"
      >
        <UButton
          icon="i-lucide-plus"
          color="neutral"
          variant="subtle"
          :disabled="!canManage"
          :label="$t('dms_lang.translation.ws_add_language')"
          @click="langAddOpen = true"
        />
      </UTooltip>
    </div>

    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <DmsKpiCard
        v-for="kpi in kpis"
        :key="kpi.key"
        component-id=""
        page-id=""
        variant="stat"
        :title="kpi.title"
        :icon="kpi.icon"
        :static-value="kpi.value"
        :value-format="kpi.format"
        :show-delta="false"
      />
    </div>

    <DmsLangWorkspaceEndpoint />

    <h2 class="text-highlighted text-base font-semibold">
      {{ $t("dms_lang.translation.ws_languages") }}
    </h2>

    <div
      v-if="isLoading && !hasKeys"
      class="flex min-h-48 items-center justify-center"
    >
      <UIcon name="i-lucide-loader-circle" class="text-muted size-8 animate-spin" />
    </div>

    <div
      v-else-if="cards.length === 0 && !canManage"
      class="text-muted py-12 text-center text-sm"
    >
      {{ $t("dms_lang.translation.ws_no_languages") }}
    </div>

    <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      <DmsCard v-for="card in cards" :key="card.code">
        <div class="mb-4 flex items-center gap-3">
          <UIcon
            :name="card.flag ? `flagpack:${card.flag}` : 'i-lucide-globe'"
            class="size-7 shrink-0"
          />
          <div class="min-w-0 flex-1">
            <div class="text-highlighted truncate font-semibold">{{ card.name }}</div>
            <div class="text-muted font-mono text-xs">{{ card.code }}</div>
          </div>
          <UBadge
            v-if="card.isDefault"
            color="primary"
            variant="subtle"
            icon="i-lucide-star"
          >
            {{ $t("dms_lang.translation.default") }}
          </UBadge>
          <UBadge v-if="card.isRtl" color="neutral" variant="subtle">RTL</UBadge>
        </div>

        <div class="mb-1.5 flex items-center justify-between">
          <span class="text-muted text-xs">{{ $t("dms_lang.overview.coverage") }}</span>
          <span class="text-highlighted font-mono text-xs">{{ card.coverage }}%</span>
        </div>
        <UProgress :model-value="card.coverage" :color="coverageColor(card.coverage)" />
        <p class="mt-1.5 text-xs" :class="card.missing > 0 ? 'text-warning' : 'text-muted'">
          {{
            card.isDefault
              ? $t("dms_lang.overview.base_language")
              : card.missing > 0
                ? $t("dms_lang.overview.keys_missing", { count: card.missing })
                : hasKeys
                  ? $t("dms_lang.overview.complete")
                  : "—"
          }}
        </p>

        <USeparator class="my-4" />

        <div class="flex flex-wrap gap-2">
          <UButton
            :to="translateTarget(card)"
            icon="i-lucide-languages"
            color="neutral"
            variant="subtle"
            size="xs"
            :label="$t('dms_lang.overview.translate')"
          />
          <UButton
            v-if="canManage && !card.isDefault"
            color="neutral"
            variant="ghost"
            size="xs"
            :label="$t('dms_lang.overview.set_default')"
            @click="makeDefault(card.code)"
          />
          <div class="flex-1" />
          <UButton
            v-if="canManage && !card.isDefault"
            icon="i-lucide-trash-2"
            color="error"
            variant="ghost"
            size="xs"
            :aria-label="$t('dms_lang.translation.ws_delete')"
            @click="removeLanguage(card.code)"
          />
        </div>
      </DmsCard>

      <button
        v-if="canManage"
        type="button"
        class="border-default text-muted hover:border-primary/50 hover:text-highlighted hover:bg-elevated/30 flex min-h-44 cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border border-dashed transition-colors"
        @click="langAddOpen = true"
      >
        <span
          class="bg-elevated/60 grid size-10 place-items-center rounded-full"
        >
          <UIcon name="i-lucide-plus" class="size-5" />
        </span>
        <span class="text-sm font-medium">
          {{ $t("dms_lang.translation.ws_add_language") }}
        </span>
      </button>
    </div>

    <DmsLangLanguageAddModal
      v-model:open="langAddOpen"
      @added="reload"
    />

    <UModal v-model:open="wsRenameOpen" :title="$t('dms_lang.translation.ws_rename')">
      <template #body>
        <UFormField
          :label="$t('dms_lang.translation.ws_workspace_name')"
          :help="$t('dms_lang.translation.ws_workspace_name_help')"
        >
          <UInput v-model="wsRenameForm.newId" class="w-full" />
        </UFormField>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton
            color="neutral"
            variant="ghost"
            :label="$t('dms_lang.translation.ws_cancel')"
            @click="wsRenameOpen = false"
          />
          <UButton
            :label="$t('dms_lang.translation.ws_save')"
            :disabled="!canRename"
            @click="submitRenameWorkspace"
          />
        </div>
      </template>
    </UModal>
  </div>
</template>
