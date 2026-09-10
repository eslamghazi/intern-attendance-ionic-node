var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Injectable } from '@nestjs/common';
import { arLocale } from './locales/ar.js';
import { enLocale } from './locales/en.js';
let I18nService = class I18nService {
    locales = {
        ar: arLocale,
        en: enLocale,
    };
    /**
     * Translate a message key or error code into the target language.
     * Supports both dotted paths ("auth.invalid_credentials") and flat codes ("invalid_credentials").
     */
    translate(key, lang = 'ar', params) {
        const selectedLocale = this.locales[lang] ?? this.locales.ar;
        let text;
        // 1. Try exact dotted path
        if (key.includes('.')) {
            const parts = key.split('.');
            let curr = selectedLocale;
            for (const part of parts) {
                if (curr && typeof curr === 'object' && part in curr) {
                    curr = curr[part];
                }
                else {
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
    resolveLanguage(headersOrRaw) {
        if (!headersOrRaw)
            return 'ar';
        if (typeof headersOrRaw === 'string') {
            const val = headersOrRaw.trim().toLowerCase();
            if (val.startsWith('en'))
                return 'en';
            if (val.startsWith('ar'))
                return 'ar';
        }
        if (typeof headersOrRaw === 'object' && headersOrRaw !== null) {
            const headers = headersOrRaw;
            const customLang = headers['x-language'] ?? headers['x-lang'];
            if (typeof customLang === 'string') {
                const cl = customLang.trim().toLowerCase();
                if (cl.startsWith('en'))
                    return 'en';
                if (cl.startsWith('ar'))
                    return 'ar';
            }
            const acceptLanguage = headers['accept-language'];
            if (typeof acceptLanguage === 'string') {
                // Parse 'ar-EG,ar;q=0.9,en-US;q=0.8,en;q=0.7'
                const parts = acceptLanguage.split(',').map((p) => p.trim());
                for (const part of parts) {
                    const code = part.split(';')[0]?.trim().toLowerCase() ?? '';
                    if (code.startsWith('en'))
                        return 'en';
                    if (code.startsWith('ar'))
                        return 'ar';
                }
            }
        }
        return 'ar';
    }
};
I18nService = __decorate([
    Injectable()
], I18nService);
export { I18nService };
//# sourceMappingURL=i18n.service.js.map