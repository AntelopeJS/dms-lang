export interface LocaleMeta {
  name: string
  flag: string
}

export const useLocaleMeta = () => {
  const { uniqueLocales } = useUniqueLocales()
  const { resolveLanguage } = useLanguageCatalog()

  function localeMetaOf(code: string): LocaleMeta {
    const meta = uniqueLocales.value.find((locale) => locale.code === code)
    const language = resolveLanguage(code)
    const name = language.name === code ? meta?.name ?? code : language.name
    return { name, flag: language.flag }
  }

  return { localeMetaOf }
}
