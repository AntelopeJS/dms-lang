import {
  EMPTY_FLAT,
  type FlatTranslations,
} from "./useTranslationProgress";

/**
 * Flat translations of the globally selected workspace. Reloads on selection
 * change (sequence-guarded so a stale response never overwrites a fresher
 * one, and cleared on workspace switch so the previous workspace's numbers
 * never show), surfaces load failures as an error toast instead of silently
 * rendering empty data, and refreshes the shared workspace list on mount.
 */
export const useWorkspaceFlat = () => {
  const { t } = useI18n();
  const toast = useToast();
  const { confirm } = useConfirm();
  const { tryMutate } = useMutationToast();
  const { selectedWorkspace, fetchWorkspaces, removeLocale } =
    useI18nWorkspaces();
  const { fetchFlat } = useTranslationProgress();

  const flat = ref<FlatTranslations>(EMPTY_FLAT);
  const isLoading = ref(false);
  let requestId = 0;
  let loadedWorkspace = "";

  async function loadFlat(): Promise<void> {
    if (!selectedWorkspace.value) return;
    if (selectedWorkspace.value !== loadedWorkspace) flat.value = EMPTY_FLAT;
    requestId += 1;
    const id = requestId;
    isLoading.value = true;
    try {
      const result = await fetchFlat(selectedWorkspace.value);
      if (id !== requestId) return;
      if (!result) {
        toast.add({
          title: t("dms_lang.translation.ws_load_error"),
          color: "error",
        });
        return;
      }
      flat.value = result;
      loadedWorkspace = selectedWorkspace.value;
    } finally {
      if (id === requestId) isLoading.value = false;
    }
  }

  function reload(): Promise<unknown> {
    return Promise.all([fetchWorkspaces(), loadFlat()]);
  }

  async function removeLanguage(code: string): Promise<void> {
    const workspace = selectedWorkspace.value;
    const confirmed = await confirm({
      title: t("dms_lang.translation.ws_delete_language_title"),
      description: t("dms_lang.translation.ws_delete_language_confirm", {
        code,
      }),
      confirmLabel: t("dms_lang.translation.ws_delete"),
      confirmColor: "error",
    });
    if (!confirmed) return;
    const ok = await tryMutate(() => removeLocale(workspace, code));
    if (!ok) return;
    await reload();
  }

  watch(selectedWorkspace, loadFlat, { immediate: true });

  onMounted(() => fetchWorkspaces());

  return {
    flat,
    isLoading: readonly(isLoading),
    loadFlat,
    reload,
    removeLanguage,
  };
};
