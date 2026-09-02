import { IonIcon } from '@ionic/react';
import { timeOutline } from 'ionicons/icons';
import { useTranslation } from 'react-i18next';
import { useNow } from '../lib/clock';

// Live app clock — reads the single, server-synced app clock (see lib/clock).
const CAIRO = 'Africa/Cairo';

export default function ServerClock() {
  const { i18n } = useTranslation();
  const now = useNow();

  const locale = i18n.language === 'ar' ? 'ar-EG' : 'en-GB';
  const dateStr = new Intl.DateTimeFormat(locale, {
    timeZone: CAIRO,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(now);
  const timeStr = new Intl.DateTimeFormat(locale, {
    timeZone: CAIRO,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).format(now);

  return (
    <div className="server-clock ui-surface ui-section">
      <IonIcon icon={timeOutline} className="server-clock__icon" />
      <div>
        <div className="server-clock__time">{timeStr}</div>
        <div className="server-clock__date">{dateStr}</div>
      </div>
    </div>
  );
}
