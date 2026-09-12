export type SupportedLanguage = 'ar' | 'en';

/**
 * What a language can be worked out from.
 *
 * Either an explicit code the caller already has ('en', 'ar-EG'), or a bag of
 * HTTP headers to read `x-language` and `accept-language` out of. Node types a
 * header value as `string | string[]` — repeated headers arrive as a list — so
 * everything here tests for a string before using one.
 */
export type HeaderBag = Record<string, string | string[] | undefined>;

export type LanguageSource = string | HeaderBag | null;

export interface II18nDictionary {
  [key: string]: string | II18nDictionary;
}
