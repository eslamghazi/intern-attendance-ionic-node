/** Today's date as yyyy-mm-dd in the operational timezone (Africa/Cairo).
 *  NOTE: reads the DEVICE clock — this is ONLY the offline fallback for
 *  getServerNow when the server RPC is unreachable. Everywhere else, current
 *  date/time comes from the single app clock (src/lib/clock.ts). */
export function cairoDateLabel(): string {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Cairo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return fmt.format(new Date()); // en-CA -> yyyy-mm-dd
}

/** Format an ISO timestamp as a 12-hour time (h:mm AM/PM) in the operational
 *  timezone (Africa/Cairo), so it shows correctly regardless of device tz. */
export function formatTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-US', {
    timeZone: 'Africa/Cairo',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/** Format an ISO timestamp as dd/mm/yyyy h:mm AM/PM in the operational timezone. */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const date = d.toLocaleDateString('en-GB', {
    timeZone: 'Africa/Cairo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const time = d.toLocaleTimeString('en-US', {
    timeZone: 'Africa/Cairo',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  return `${date} ${time}`;
}

/** Format a clock string ('HH:mm' or 'HH:mm:ss') as 12-hour (h:mm AM/PM). */
export function formatClock(value: string | null | undefined): string {
  if (!value) return '—';
  const [h, m] = String(value).split(':');
  const hh = Number(h);
  if (Number.isNaN(hh)) return String(value);
  const period = hh < 12 ? 'AM' : 'PM';
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  return `${h12}:${(m ?? '00').padStart(2, '0')} ${period}`;
}

/** Format a date (yyyy-mm-dd or ISO) as dd/mm/yyyy for display. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const [y, m, d] = String(value).slice(0, 10).split('-');
  if (!y || !m || !d) return String(value);
  return `${d}/${m}/${y}`;
}

/** Localized "month year" label (e.g. "أغسطس ٢٠٢٦" / "August 2026"). */
export function formatMonth(year: number, month: number, locale = 'ar-EG'): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      month: 'long',
      year: 'numeric',
      timeZone: 'Africa/Cairo',
    }).format(new Date(Date.UTC(year, month - 1, 1)));
  } catch {
    return `${String(month).padStart(2, '0')}/${year}`;
  }
}
