export type SupportedLanguage = 'ar' | 'en';

export interface II18nDictionary {
  [key: string]: string | II18nDictionary;
}
