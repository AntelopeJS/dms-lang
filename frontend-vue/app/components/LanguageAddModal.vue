<script setup lang="ts">
import type { LanguageCatalogEntry } from "../composables/translation/useLanguageCatalog";

interface Emits {
  added: [];
}

const EMPTY_FORM: LanguageCatalogEntry = { code: "", name: "", flag: "" };

const open = defineModel<boolean>("open", { required: true });
const emit = defineEmits<Emits>();

const { tryMutate } = useMutationToast();
const { items: languageItems, resolveLanguage } = useLanguageCatalog();
const { selectedWorkspace, addLocale } = useI18nWorkspaces();

const form = ref<LanguageCatalogEntry>({ ...EMPTY_FORM });
const isSubmitting = ref(false);

watch(open, (isOpen) => {
  if (isOpen) form.value = { ...EMPTY_FORM };
});

async function submit() {
  const workspace = selectedWorkspace.value;
  const { code, name, flag } = form.value;
  isSubmitting.value = true;
  const ok = await tryMutate(() =>
    addLocale(workspace, {
      code,
      name: name || undefined,
      flag: flag || undefined,
    }),
  );
  isSubmitting.value = false;
  if (!ok) return;
  open.value = false;
  emit("added");
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="$t('dms_lang.translation.ws_add_language')"
  >
    <template #body>
      <UFormField :label="$t('dms_lang.translation.ws_language')">
        <USelectMenu
          :model-value="form.code"
          :items="languageItems"
          value-key="value"
          label-key="label"
          searchable
          class="w-full"
          :placeholder="$t('dms_lang.translation.ws_language_select')"
          @update:model-value="form = resolveLanguage($event)"
        />
      </UFormField>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton
          color="neutral"
          variant="ghost"
          :label="$t('dms_lang.translation.ws_cancel')"
          @click="open = false"
        />
        <UButton
          :label="$t('dms_lang.translation.ws_add')"
          :loading="isSubmitting"
          :disabled="!form.code"
          @click="submit"
        />
      </div>
    </template>
  </UModal>
</template>
