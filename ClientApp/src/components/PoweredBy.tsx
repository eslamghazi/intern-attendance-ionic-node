import { useTranslation } from 'react-i18next';
import { CALAIX } from '../lib/config';
import { appNow } from '../lib/clock';

/**
 * Vendor credit and copyright — on the sign-in screen and in the menu, the
 * two places a footer cannot go. The app is the work of Calaix AI and
 * Eslam Ghazi, and says so wherever it is seen.
 */
export default function PoweredBy() {
  const { t } = useTranslation();
  const year = appNow().getFullYear();
  return (
    <div className="powered-by-block">
      <a className="powered-by" href={CALAIX.url} target="_blank" rel="noreferrer">
        <span>{t('common.poweredBy')}</span>
        <img src={CALAIX.logo} alt={CALAIX.name} />
      </a>
      <div className="powered-by__rights ltr-nums">
        © {year} {CALAIX.name} · {CALAIX.author} · {t('common.rightsReserved')}
      </div>
    </div>
  );
}
