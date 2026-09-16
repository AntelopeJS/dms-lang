<script setup lang="ts">
import type { DropdownMenuItem } from "@nuxt/ui";
import type { WorkspaceSummary } from "../composables/translation/useI18nWorkspaces";
import type { LanguageCatalogEntry } from "../composables/translation/useLanguageCatalog";

interface WorkspaceForm extends LanguageCatalogEntry {
  id: string;
}

interface Props {
  collapsed?: boolean;
}

const EMPTY_FORM: WorkspaceForm = { id: "", code: "", name: "", flag: "" };

defineProps<Props>();

const { t } = useI18n();
const { tryMutate } = useMutationToast();
const { current } = useWorkspaceContext();
const { items: languageItems, resolveLanguage } = useLanguageCatalog();
const {
  workspaces,
  editable,
  selectedWorkspace,
  isLoading,
  fetchWorkspaces,
  canUseWorkspaceId,
  createWorkspace,
} = useI18nWorkspaces();

const currentIcon = computed(() =>
  current.value?.editable ? "i-lucide-pencil" : "i-lucide-lock",
);

const subtitle = computed(() =>
  t("dms_lang.sidebar.languages_count", current.value?.locales.length ?? 0),
);

const menuItems = computed<DropdownMenuItem[][]>(() => {
  const groups: DropdownMenuItem[][] = [
    workspaces.value.map((workspace: WorkspaceSummary) => ({
      label: workspace.id,
      icon: workspace.editable ? "i-lucide-pencil" : "i-lucide-lock",
      type: "checkbox" as const,
      checked: workspace.id === selectedWorkspace.value,
      onSelect: () => {
        selectedWorkspace.value = workspace.id;
      },
    })),
  ];
  if (editable.value) {
    groups.push([
      {
        label: t("dms_lang.translation.ws_new"),
        icon: "i-lucide-plus",
        onSelect: openCreateWorkspace,
      },
    ]);
  }
  return groups;
});

const createOpen = ref(false);
const createForm = ref<WorkspaceForm>({ ...EMPTY_FORM });
const isSubmitting = ref(false);

const normalizedId = computed(() => normalizeWorkspaceId(createForm.value.id));
const canCreate = computed(
  () => canUseWorkspaceId(normalizedId.value) && Boolean(createForm.value.code),
);

function openCreateWorkspace() {
  createForm.value = { ...EMPTY_FORM };
  createOpen.value = true;
}

async function submitCreateWorkspace() {
  if (isSubmitting.value || !canCreate.value) return;
  const id = normalizedId.value;
  const { code, name, flag } = createForm.value;
  isSubmitting.value = true;
  const ok = await tryMutate(() =>
    createWorkspace(id, { code, name: name || undefined, flag: flag || undefined }),
  );
  isSubmitting.value = false;
  if (!ok) return;
  createOpen.value = false;
  const list = await fetchWorkspaces();
  if (list.some((workspace) => workspace.id === id)) {
    selectedWorkspace.value = id;
  }
}

onMounted(() => {
  if (workspaces.value.length === 0) fetchWorkspaces();
});
</script>

<template>
  <UDropdownMenu
    v-if="workspaces.length > 0"
    :items="menuItems"
    :content="{ align: 'start' }"
    :ui="{ content: 'w-56' }"
  >
    <button
      type="button"
      class="border-default hover:bg-elevated/50 flex w-full items-center gap-2.5 rounded-lg border p-2 text-left transition-colors"
      :class="{ 'justify-center border-transparent p-1.5': collapsed }"
      :aria-label="collapsed ? t('dms_lang.sidebar.workspace') : undefined"
    >
      <span
        class="bg-primary/10 ring-primary/20 grid size-8 shrink-0 place-items-center rounded-md ring"
      >
        <UIcon :name="currentIcon" class="text-primary size-4" />
      </span>
      <template v-if="!collapsed">
        <span class="min-w-0 flex-1">
          <span class="text-highlighted block truncate text-sm font-semibold">
            {{ selectedWorkspace || t("dms_lang.sidebar.workspace") }}
          </span>
          <span class="text-muted block truncate text-xs">{{ subtitle }}</span>
        </span>
        <UIcon
          name="i-lucide-chevrons-up-down"
          class="text-muted size-4 shrink-0"
        />
      </template>
    </button>
  </UDropdownMenu>
  <USkeleton
    v-else-if="isLoading"
    class="rounded-lg"
    :class="collapsed ? 'mx-auto size-11' : 'h-12 w-full'"
  />

  <UModal v-model:open="createOpen" :title="$t('dms_lang.translation.ws_new')">
    <template #body>
      <div class="space-y-4">
        <UFormField
          :label="$t('dms_lang.translation.ws_workspace_name')"
          :help="$t('dms_lang.translation.ws_workspace_name_help')"
        >
          <UInput v-model="createForm.id" class="w-full" />
        </UFormField>
        <UFormField :label="$t('dms_lang.translation.ws_default_locale')">
          <USelectMenu
            :model-value="createForm.code"
            :items="languageItems"
            value-key="value"
            label-key="label"
            searchable
            class="w-full"
            :placeholder="$t('dms_lang.translation.ws_language_select')"
            @update:model-value="
              createForm = { ...resolveLanguage($event), id: createForm.id }
            "
          />
        </UFormField>
      </div>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton
          color="neutral"
          variant="ghost"
          :label="$t('dms_lang.translation.ws_cancel')"
          @click="createOpen = false"
        />
        <UButton
          :label="$t('dms_lang.translation.ws_create')"
          :loading="isSubmitting"
          :disabled="!canCreate"
          @click="submitCreateWorkspace"
        />
      </div>
    </template>
  </UModal>
</template>
