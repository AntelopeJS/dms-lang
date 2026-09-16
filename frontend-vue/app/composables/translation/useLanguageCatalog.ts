export interface LanguageCatalogEntry {
  code: string;
  name: string;
  flag: string;
}

const LANGUAGES: LanguageCatalogEntry[] = [
  { code: "en", name: "English", flag: "gb-ukm" },
  { code: "fr", name: "Français", flag: "fr" },
  { code: "es", name: "Español", flag: "es" },
  { code: "de", name: "Deutsch", flag: "de" },
  { code: "it", name: "Italiano", flag: "it" },
  { code: "pt", name: "Português", flag: "pt" },
  { code: "nl", name: "Nederlands", flag: "nl" },
  { code: "ru", name: "Русский", flag: "ru" },
  { code: "zh", name: "中文", flag: "cn" },
  { code: "ja", name: "日本語", flag: "jp" },
  { code: "ko", name: "한국어", flag: "kr" },
  { code: "ar", name: "العربية", flag: "sa" },
  { code: "hi", name: "हिन्दी", flag: "in" },
  { code: "bn", name: "বাংলা", flag: "bd" },
  { code: "tr", name: "Türkçe", flag: "tr" },
  { code: "pl", name: "Polski", flag: "pl" },
  { code: "uk", name: "Українська", flag: "ua" },
  { code: "ro", name: "Română", flag: "ro" },
  { code: "el", name: "Ελληνικά", flag: "gr" },
  { code: "cs", name: "Čeština", flag: "cz" },
  { code: "sv", name: "Svenska", flag: "se" },
  { code: "da", name: "Dansk", flag: "dk" },
  { code: "fi", name: "Suomi", flag: "fi" },
  { code: "no", name: "Norsk", flag: "no" },
  { code: "hu", name: "Magyar", flag: "hu" },
  { code: "sk", name: "Slovenčina", flag: "sk" },
  { code: "bg", name: "Български", flag: "bg" },
  { code: "hr", name: "Hrvatski", flag: "hr" },
  { code: "sr", name: "Српски", flag: "rs" },
  { code: "sl", name: "Slovenščina", flag: "si" },
  { code: "et", name: "Eesti", flag: "ee" },
  { code: "lv", name: "Latviešu", flag: "lv" },
  { code: "lt", name: "Lietuvių", flag: "lt" },
  { code: "he", name: "עברית", flag: "il" },
  { code: "th", name: "ไทย", flag: "th" },
  { code: "vi", name: "Tiếng Việt", flag: "vn" },
  { code: "id", name: "Bahasa Indonesia", flag: "id" },
  { code: "ms", name: "Bahasa Melayu", flag: "my" },
  { code: "fa", name: "فارسی", flag: "ir" },
  { code: "ur", name: "اردو", flag: "pk" },
  { code: "ta", name: "தமிழ்", flag: "in" },
  { code: "te", name: "తెలుగు", flag: "in" },
  { code: "sw", name: "Kiswahili", flag: "ke" },
  { code: "af", name: "Afrikaans", flag: "za" },
  { code: "is", name: "Íslenska", flag: "is" },
  { code: "ga", name: "Gaeilge", flag: "ie" },
  { code: "sq", name: "Shqip", flag: "al" },
  { code: "mk", name: "Македонски", flag: "mk" },
  { code: "bs", name: "Bosanski", flag: "ba" },
  { code: "ka", name: "ქართული", flag: "ge" },
  { code: "hy", name: "Հայերեն", flag: "am" },
  { code: "az", name: "Azərbaycan", flag: "az" },
  { code: "kk", name: "Қазақ", flag: "kz" },
  { code: "uz", name: "Oʻzbek", flag: "uz" },
  { code: "mn", name: "Монгол", flag: "mn" },
  { code: "ne", name: "नेपाली", flag: "np" },
  { code: "si", name: "සිංහල", flag: "lk" },
  { code: "km", name: "ខ្មែរ", flag: "kh" },
  { code: "my", name: "မြန်မာ", flag: "mm" },
  { code: "am", name: "አማርኛ", flag: "et" },
  { code: "tl", name: "Tagalog", flag: "ph" },
];

export interface LanguageSelectItem {
  label: string;
  value: string;
  icon: string;
}

const BY_CODE = new Map(LANGUAGES.map((lang) => [lang.code, lang]));

const ITEMS: LanguageSelectItem[] = LANGUAGES.map((lang) => ({
  label: `${lang.name} (${lang.code})`,
  value: lang.code,
  icon: `flagpack:${lang.flag}`,
}));

export const useLanguageCatalog = () => {
  const resolveLanguage = (code: string): LanguageCatalogEntry =>
    BY_CODE.get(code) ?? { code, name: code, flag: "" };

  return { items: ITEMS, resolveLanguage };
};
