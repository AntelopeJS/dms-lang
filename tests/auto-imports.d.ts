/**
 * The names the DMS frontend build auto-imports into the module's frontend
 * sources, and the tests assign to `globalThis`, typed as the sources and
 * layers that define them, so the linter reads the composables under test
 * with their real types.
 */
declare global {
  const DEFAULT_WORKSPACE: typeof import("../frontend-vue/app/composables/translation/useI18nWorkspaces.ts").DEFAULT_WORKSPACE;
  const ENDPOINTS: typeof import("../frontend-vue/app/composables/translation/useI18nWorkspaces.ts").ENDPOINTS;
  const LANG_PAGES: typeof import("../frontend-vue/app/composables/translation/useLangLinks.ts").LANG_PAGES;
  type LangPage =
    import("../frontend-vue/app/composables/translation/useLangLinks.ts").LangPage;
  const MODULES_WORKSPACE: typeof import("../frontend-vue/app/composables/translation/useI18nWorkspaces.ts").MODULES_WORKSPACE;
  const PAGE_ACTION_QUERY: typeof import("../frontend-vue/app/composables/translation/useLangLinks.ts").PAGE_ACTION_QUERY;
  type PageQuery =
    import("../frontend-vue/app/composables/translation/useLangLinks.ts").PageQuery;
  const computed: typeof import("vue").computed;
  const effectScope: typeof import("vue").effectScope;
  const isLocaleValueMissing: typeof import("../frontend-vue/app/utils/translations.ts").isLocaleValueMissing;
  const isRowValueMissing: typeof import("../frontend-vue/app/utils/translations.ts").isRowValueMissing;
  const langPageOf: typeof import("../frontend-vue/app/composables/translation/useLangLinks.ts").langPageOf;
  const linkWithQuery: typeof import("../frontend-vue/app/composables/translation/useLangLinks.ts").linkWithQuery;
  const namespaceOf: typeof import("../frontend-vue/app/utils/translations.ts").namespaceOf;
  const needsReview: typeof import("../frontend-vue/app/utils/translations.ts").needsReview;
  const nextSiblingPath: typeof import("../frontend-vue/app/utils/translations.ts").nextSiblingPath;
  const nextTick: typeof import("vue").nextTick;
  const normalizeWorkspaceId: typeof import("../frontend-vue/app/composables/translation/useI18nWorkspaces.ts").normalizeWorkspaceId;
  const onBeforeUnmount: typeof import("vue").onBeforeUnmount;
  const onMounted: typeof import("vue").onMounted;
  const readonly: typeof import("vue").readonly;
  const ref: typeof import("vue").ref;
  const resolveApiErrorMessage: typeof import("../node_modules/@antelopejs/dms/frontend-vue/layers/dms-core/app/composables/useApiError.ts").resolveApiErrorMessage;
  const resolveApiErrorTitle: typeof import("../node_modules/@antelopejs/dms/frontend-vue/layers/dms-core/app/composables/useApiError.ts").resolveApiErrorTitle;
  const resolveApiMessage: typeof import("../node_modules/@antelopejs/dms/frontend-vue/layers/dms-core/app/composables/translation/useTranslation.ts").resolveApiMessage;
  const serverErrorCode: typeof import("../frontend-vue/app/composables/translation/useMutationToast.ts").serverErrorCode;
  const stringValue: typeof import("../frontend-vue/app/utils/translations.ts").stringValue;
  const toValue: typeof import("vue").toValue;
  const typedLocaleCode: typeof import("../frontend-vue/app/utils/languages.ts").typedLocaleCode;
  const useApiData: typeof import("../node_modules/@antelopejs/dms/frontend-vue/layers/dms-core/app/composables/auth/useApiData.ts").useApiData;
  const useAuthFetch: typeof import("../node_modules/@antelopejs/dms/frontend-vue/layers/dms-core/app/composables/auth/useAuthFetch.ts").useAuthFetch;
  const useI18nWorkspaces: typeof import("../frontend-vue/app/composables/translation/useI18nWorkspaces.ts").useI18nWorkspaces;
  const useMutationToast: typeof import("../frontend-vue/app/composables/translation/useMutationToast.ts").useMutationToast;
  const usePermissions: typeof import("../node_modules/@antelopejs/dms/frontend-vue/layers/dms-core/app/composables/auth/usePermissions.ts").usePermissions;
  const useRealtimeTopic: typeof import("../node_modules/@antelopejs/dms/frontend-vue/layers/dms-core/app/composables/realtime/useRealtimeTopic.ts").useRealtimeTopic;
  const useUserRealtime: typeof import("../node_modules/@antelopejs/dms/frontend-vue/layers/dms-core/app/composables/realtime/useUserRealtime.ts").useUserRealtime;
  const useWorkspaceContext: typeof import("../frontend-vue/app/composables/translation/useWorkspaceContext.ts").useWorkspaceContext;
  const useWorkspaceFlat: typeof import("../frontend-vue/app/composables/translation/useWorkspaceFlat.ts").useWorkspaceFlat;
  const useWorkspaceFlatSync: typeof import("../frontend-vue/app/composables/translation/useWorkspaceFlat.ts").useWorkspaceFlatSync;
  const useWorkspaceLabel: typeof import("../frontend-vue/app/composables/translation/useWorkspaceLabel.ts").useWorkspaceLabel;
  const useWorkspaceRoute: typeof import("../frontend-vue/app/composables/translation/useWorkspaceRoute.ts").useWorkspaceRoute;
  const watch: typeof import("vue").watch;
}

declare module "vue" {
  /** The helper a compiled `<script setup>` awaits through. */
  function withAsyncContext<Result>(
    getAwaitable: () => Promise<Result>,
  ): [Promise<Result>, () => void];
}

export {};
