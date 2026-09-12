import { Injectable } from '@nestjs/common';
import type { HeaderBag, LanguageSource, SupportedLanguage } from './i18n.types.js';
import type { II18nService } from './i18n.interface.js';
import { arLocale } from './locales/ar.js';
import { enLocale } from './locales/en.js';

@Injectable()
export class I18nService implements II18nService {
  private readonly locales: Record<SupportedLanguage, Record<string, any>> = {
    ar: arLocale,
    en: enLocale,
  };

  /**
   * Translate a message key or error code into the target language.
   * Supports both dotted paths ("auth.invalid_credentials") and flat codes ("invalid_credentials").
   */
  translate(key: string, lang: SupportedLanguage = 'ar', params?: Record<string, string | number>): string {
    const selectedLocale = this.locales[lang] ?? this.locales.ar;
    let text: string | undefined;

    // 1. Try exact dotted path
    if (key.includes('.')) {
      const parts = key.split('.');
      let curr: any = selectedLocale;
      for (const part of parts) {
        if (curr && typeof curr === 'object' && part in curr) {
          curr = curr[part];
        } else {
          curr = undefined;
          break;
        }
      }
      if (typeof curr === 'string') {
        text = curr;
      }
    }

    // 2. Search across domains by key if not found
    if (!text) {
      for (const domain of Object.keys(selectedLocale)) {
        const domainObj = selectedLocale[domain];
        if (domainObj && typeof domainObj === 'object' && key in domainObj) {
          text = domainObj[key];
          break;
        }
      }
    }

    // 3. Fallback to English if not found in Arabic or vice versa
    if (!text && lang !== 'en') {
      return this.translate(key, 'en', params);
    }

    if (!text) {
      return key;
    }

    // 4. Parameter interpolation
    if (params) {
      for (const [paramKey, val] of Object.entries(params)) {
        text = text.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(val));
      }
    }

    return text;
  }

  /**
   * Determine preferred language from HTTP headers, query, or explicit code.
   */
  resolveLanguage(headersOrRaw?: LanguageSource): SupportedLanguage {
    if (!headersOrRaw) return 'ar';

    if (typeof headersOrRaw === 'string') {
      const val = headersOrRaw.trim().toLowerCase();
      if (val.startsWith('en')) return 'en';
      if (val.startsWith('ar')) return 'ar';
    }

    if (typeof headersOrRaw === 'object' && headersOrRaw !== null) {
      const headers: HeaderBag = headersOrRaw;
      const customLang = headers['x-language'] ?? headers['x-lang'];
      if (typeof customLang === 'string') {
        const cl = customLang.trim().toLowerCase();
        if (cl.startsWith('en')) return 'en';
        if (cl.startsWith('ar')) return 'ar';
      }

      const acceptLanguage = headers['accept-language'];
      if (typeof acceptLanguage === 'string') {
        // Parse 'ar-EG,ar;q=0.9,en-US;q=0.8,en;q=0.7'
        const parts = acceptLanguage.split(',').map((p) => p.trim());
        for (const part of parts) {
          const code = part.split(';')[0]?.trim().toLowerCase() ?? '';
          if (code.startsWith('en')) return 'en';
          if (code.startsWith('ar')) return 'ar';
        }
      }
    }

    return 'ar';
  }
}
