import { arLocale } from '../../common/i18n/locales/ar.js';
import { enLocale } from '../../common/i18n/locales/en.js';
/**
 * A `report.*` string in the document's own language.
 *
 * The renderers are plain functions with no I18nService in reach, and a
 * document already says which language it is in through its direction — the
 * same signal that picks its font. So the few labels a renderer adds of its
 * own (the copyright line, the charts sheet) come from here.
 */
export function reportLabel(rtl, key) {
    return (rtl ? arLocale : enLocale).report[key];
}
//# sourceMappingURL=labels.js.map