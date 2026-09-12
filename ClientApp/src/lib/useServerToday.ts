import { appToday, useClockSubscribe } from './clock';

/** Today's date (yyyy-mm-dd) from the single server-synced app clock. Subscribes
 *  to the shared clock (without driving its own fetch) so it re-renders on each
 *  sync and always reflects the one effective time — real or frozen. */
export function useServerToday(): string {
  useClockSubscribe();
  return appToday();
}
