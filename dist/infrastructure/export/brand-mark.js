import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
/**
 * The Calaix mark, as a data URL, for the foot of every print document.
 *
 * INLINED, NOT LINKED. The print document is written into a blank window the
 * app opened and then prints itself — and the PDF the reader saves is opened
 * months later with no app beside it. A linked image is a request that
 * window makes at print time; an embedded one is simply there. The file is
 * the same SVG the app's own footer shows, taken from the built client beside
 * the API (`public/`, where the production package puts it), read once.
 *
 * Absent — a development checkout with no client build beside it — the
 * footer carries the text alone rather than a broken image.
 */
const __dirname = dirname(fileURLToPath(import.meta.url));
const CANDIDATES = [
    // src/infrastructure/export → server/public; dist/infrastructure/export → <root>/public
    resolve(__dirname, '../../../public/Calaix_Logos/Calaix_AI.svg'),
    resolve(process.cwd(), 'public/Calaix_Logos/Calaix_AI.svg'),
    resolve(process.cwd(), 'server/public/Calaix_Logos/Calaix_AI.svg'),
    resolve(process.cwd(), 'ClientApp/public/Calaix_Logos/Calaix_AI.svg'),
];
let cached;
/** `data:image/svg+xml;base64,…`, or null when no mark can be found. */
export function brandMarkDataUrl() {
    if (cached !== undefined)
        return cached;
    const path = CANDIDATES.find((p) => existsSync(p));
    cached = path ? `data:image/svg+xml;base64,${readFileSync(path).toString('base64')}` : null;
    return cached;
}
//# sourceMappingURL=brand-mark.js.map