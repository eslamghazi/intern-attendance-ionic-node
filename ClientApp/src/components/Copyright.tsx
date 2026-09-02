import { useTranslation } from 'react-i18next';
import { CALAIX } from '../lib/config';
import { appNow } from '../lib/clock';

/** App copyright footer, shown on every role's main screen. */
export default function Copyright() {
  const { t } = useTranslation();
  const year = appNow().getFullYear();
  return (
    <div className="app-copyright">
      <img src={CALAIX.logo} alt={CALAIX.name} className="app-copyright__logo" />
      <span className="ltr-nums">
        © {year} {CALAIX.name} · {t('common.rightsReserved')}
      </span>
    </div>
  );
}
