import { COPYRIGHT } from '../../config/constants.js';
import { reportLabel } from './labels.js';
/**
 * The line every export carries at the foot: who it belongs to.
 *
 * Built here rather than in each renderer so the workbook and the print
 * document cannot drift on how it reads. The names are not translated; the
 * rights phrase is.
 */
export function copyrightLine(rtl, year = new Date().getFullYear()) {
    return `© ${year} ${COPYRIGHT.holder} · ${COPYRIGHT.author} · ${reportLabel(rtl, 'rights_reserved')}`;
}
//# sourceMappingURL=copyright.js.map