import { useState } from 'react';
import { IonButton, IonIcon, IonInput } from '@ionic/react';
import {
  chevronBack,
  chevronForward,
  playSkipBack,
  playSkipForward,
} from 'ionicons/icons';
import { useTranslation } from 'react-i18next';

/** Build a compact page list around the current page with `…` gaps.
 *  e.g. 1 … 4 5 [6] 7 8 … 20 */
function pageWindow(page: number, pages: number): (number | '…')[] {
  const span = 1; // neighbours on each side of the current page
  const out: (number | '…')[] = [];
  const add = (n: number) => out.push(n);
  const lo = Math.max(2, page - span);
  const hi = Math.min(pages - 1, page + span);
  add(1);
  if (lo > 2) out.push('…');
  for (let n = lo; n <= hi; n++) add(n);
  if (hi < pages - 1) out.push('…');
  if (pages > 1) add(pages);
  return out;
}

/** Pagination: first / prev / numbered pages (with ellipsis) / next / last,
 *  plus a "go to page" box. Arrows point the natural way in LTR and RTL. */
export default function Pager({
  page,
  pages,
  onPage,
}: {
  page: number;
  pages: number;
  onPage: (p: number) => void;
}) {
  const { t, i18n } = useTranslation();
  const rtl = i18n.dir() === 'rtl';
  const prevIcon = rtl ? chevronForward : chevronBack;
  const nextIcon = rtl ? chevronBack : chevronForward;
  const firstIcon = rtl ? playSkipForward : playSkipBack;
  const lastIcon = rtl ? playSkipBack : playSkipForward;
  const [goto, setGoto] = useState('');

  if (pages <= 1) return null;
  const clamp = (n: number) => Math.min(pages, Math.max(1, n));
  const submitGoto = () => {
    const n = parseInt(goto, 10);
    if (!Number.isNaN(n)) onPage(clamp(n));
    setGoto('');
  };

  return (
    <div className="pager">
      <IonButton className="pager__btn" size="small" fill="clear" disabled={page <= 1} onClick={() => onPage(1)}>
        <IonIcon slot="icon-only" icon={firstIcon} />
      </IonButton>
      <IonButton className="pager__btn" size="small" fill="clear" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        <IonIcon slot="icon-only" icon={prevIcon} />
      </IonButton>

      {pageWindow(page, pages).map((p, i) =>
        p === '…' ? (
          <span key={`gap-${i}`} className="pager__gap">
            …
          </span>
        ) : (
          <IonButton
            key={p}
            className="pager__num ltr-nums"
            size="small"
            fill={p === page ? 'solid' : 'clear'}
            onClick={() => onPage(p)}
          >
            {p}
          </IonButton>
        ),
      )}

      <IonButton className="pager__btn" size="small" fill="clear" disabled={page >= pages} onClick={() => onPage(page + 1)}>
        <IonIcon slot="icon-only" icon={nextIcon} />
      </IonButton>
      <IonButton className="pager__btn" size="small" fill="clear" disabled={page >= pages} onClick={() => onPage(pages)}>
        <IonIcon slot="icon-only" icon={lastIcon} />
      </IonButton>

      <span className="pager__goto">
        <IonInput
          className="pager__input ltr-nums"
          type="number"
          inputmode="numeric"
          min={1}
          max={pages}
          placeholder="#"
          value={goto}
          onIonInput={(e) => setGoto(e.detail.value ?? '')}
          onKeyDown={(e) => e.key === 'Enter' && submitGoto()}
        />
        <IonButton size="small" fill="outline" disabled={!goto} onClick={submitGoto}>
          {t('common.go')}
        </IonButton>
      </span>
    </div>
  );
}
