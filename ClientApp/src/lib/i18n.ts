import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ar from '../i18n/ar.json';
import en from '../i18n/en.json';
import { STORAGE_KEYS } from './config';

export const supportedLngs = ['ar', 'en'] as const;
export type Lang = (typeof supportedLngs)[number];

const LANG_KEY = STORAGE_KEYS.LANG;

/** Apply text direction + lang attribute to <html> for RTL/LTR. */
export function applyDirection(lng: string): void {
  const dir = lng === 'ar' ? 'rtl' : 'ltr';
  document.documentElement.setAttribute('dir', dir);
  document.documentElement.setAttribute('lang', lng);
}

const initial =
  (typeof localStorage !== 'undefined' && localStorage.getItem(LANG_KEY)) || 'ar';

void i18n.use(initReactI18next).init({
  resources: {
    ar: { translation: ar },
    en: { translation: en },
  },
  lng: initial,
  fallbackLng: 'ar',
  supportedLngs: [...supportedLngs],
  interpolation: { escapeValue: false },
});

i18n.on('languageChanged', (lng) => {
  try {
    localStorage.setItem(LANG_KEY, lng);
  } catch {
    /* ignore */
  }
  applyDirection(lng);
});

applyDirection(initial);

export default i18n;
