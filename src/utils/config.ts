export interface TranslationConfig {
  workspacesDir: string;
  editable: boolean;
}

let config: TranslationConfig | null = null;

export function setTranslationConfig(value: TranslationConfig): void {
  config = value;
}

export function getTranslationConfig(): TranslationConfig {
  if (!config) {
    throw new Error("Translation config has not been initialised");
  }
  return config;
}
