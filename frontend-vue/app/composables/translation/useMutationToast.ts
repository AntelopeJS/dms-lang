interface MutationError {
  data?: { statusMessage?: string };
  statusMessage?: string;
}

export const useMutationToast = () => {
  const { t } = useI18n();
  const toast = useToast();

  function errorMessage(error: unknown): string {
    const e = error as MutationError;
    return (
      e?.data?.statusMessage ??
      e?.statusMessage ??
      t("dms_lang.translation.ws_save_error")
    );
  }

  async function tryMutate(fn: () => Promise<unknown>): Promise<boolean> {
    try {
      await fn();
      return true;
    } catch (error) {
      toast.add({ title: errorMessage(error), color: "error" });
      return false;
    }
  }

  return { tryMutate };
};
