<script setup lang="ts">
type SnippetKind = 'i18next' | 'fetch' | 'curl'

const SNIPPETS: Record<SnippetKind, (url: string, base: string) => string> = {
  i18next: (url, base) =>
    [
      `import HttpBackend from "i18next-http-backend";`,
      '',
      'i18next.use(HttpBackend).init({',
      `  fallbackLng: "${base}",`,
      `  backend: { loadPath: "${url.replace('{locale}', '{{lng}}')}" },`,
      '});',
    ].join('\n'),
  fetch: (url, base) =>
    [
      `const locale = navigator.language || "${base}";`,
      `const response = await fetch(\`${url.replace('{locale}', '${locale}')}\`);`,
      'const messages = await response.json();',
    ].join('\n'),
  curl: (url, base) => `curl ${url.replace('{locale}', base)}`,
}

const { current, isAdded } = useWorkspaceContext()
const { flat } = useWorkspaceFlat()
const links = useLangLinks()

const kind = ref<SnippetKind>('i18next')
const kindItems = [
  { label: 'i18next', value: 'i18next' },
  { label: 'fetch', value: 'fetch' },
  { label: 'curl', value: 'curl' },
]

const url = computed(() =>
  current.value ? links.publicLocaleUrl(current.value.id) : '',
)
const snippet = computed(() =>
  SNIPPETS[kind.value](url.value, flat.value.defaultLocale || 'en'),
)
</script>

<template>
  <DmsCard
    v-if="isAdded && current"
    :padded="false"
    :title="$t('dms_lang.endpoint.title')"
  >
    <template #actions>
      <DmsSegmented
        v-model="kind"
        :items="kindItems"
        size="xs"
        variant="mono"
      />
    </template>
    <div class="border-default flex items-center gap-2.5 border-b px-4 py-3">
      <DmsStatusPill tone="success" size="sm" label="GET" dot="none" />
      <code class="text-default min-w-0 flex-1 truncate font-mono text-xs">
        {{ url }}
      </code>
      <DmsCopyButton :value="url" />
    </div>
    <div class="relative">
      <pre
        class="text-default overflow-x-auto px-4 py-3 font-mono text-xs leading-relaxed"
        >{{ snippet }}</pre>
      <DmsCopyButton :value="snippet" class="absolute right-2 top-2" />
    </div>
    <template #footer>
      <p class="text-dimmed flex items-center gap-1.5 text-xs">
        <UIcon name="i-ph-info" class="size-3.5" />
        {{ $t('dms_lang.endpoint.note') }}
      </p>
    </template>
  </DmsCard>
</template>
