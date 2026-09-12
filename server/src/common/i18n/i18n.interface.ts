import type { LanguageSource, SupportedLanguage } from './i18n.types.js';

export interface II18nService {
  translate(key: string, lang?: SupportedLanguage, params?: Record<string, string | number>): string;
  resolveLanguage(headersOrRaw?: LanguageSource): SupportedLanguage;
}
