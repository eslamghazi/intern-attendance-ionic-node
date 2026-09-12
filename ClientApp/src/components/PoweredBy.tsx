import { useTranslation } from 'react-i18next';
import { CALAIX } from '../lib/config';

/** Vendor credit / licensing mark — the app is licensed by Calaix AI. */
export default function PoweredBy() {
  const { t } = useTranslation();
  return (
    <a className="powered-by" href={CALAIX.url} target="_blank" rel="noreferrer">
      <span>{t('common.poweredBy')}</span>
      <img src={CALAIX.logo} alt={CALAIX.name} />
    </a>
  );
}
