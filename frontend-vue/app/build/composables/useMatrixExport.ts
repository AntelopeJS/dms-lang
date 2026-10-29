import type { Ref } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UDropdownMenu from '@nuxt/ui/components/DropdownMenu.vue'
import type { FlatTranslationRow, FlatTranslations } from '../../types/lang'
import { exportFileName, translationsCsv } from '../../utils/matrixExport'

interface MatrixExportOptions {
  t: ReturnType<typeof useI18n>['t']
  formatCount: (value: number) => string
  flat: Readonly<Ref<FlatTranslations>>
  rows: Readonly<Ref<FlatTranslationRow[]>>
  columnCodes: Readonly<Ref<string[]>>
  order: Readonly<Ref<string[]>>
  selectedWorkspace: Readonly<Ref<string>>
  isLoaded: Readonly<Ref<boolean>>
}

/**
 * The export menu of the matrix in the page header: the keys and languages
 * the matrix shows, or the whole workspace, as a CSV file.
 */
export function useMatrixExport({
  t,
  formatCount,
  flat,
  rows,
  columnCodes,
  order,
  selectedWorkspace,
  isLoaded,
}: MatrixExportOptions) {
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
}
