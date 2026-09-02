import { useIonLoading, useIonToast } from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { describeDbError } from '../../lib/dbError';

/** Toast + loader helpers for mutations. */
export function useFeedback() {
  const [present] = useIonToast();
  const [showLoading, dismissLoading] = useIonLoading();
  const { t } = useTranslation();

  const toast = (message: string, color: 'success' | 'danger' | 'warning' = 'success') =>
    present({ message, duration: color === 'success' ? 2000 : 2800, color });

  /** Run an async action behind a loader; toast on success/error. */
  const run = async <T>(
    fn: () => Promise<T>,
    opts: { success?: string; error?: string } = {},
  ): Promise<T | undefined> => {
    await showLoading({ message: t('common.loading') });
    try {
      const result = await fn();
      await dismissLoading();
      if (opts.success) toast(opts.success, 'success');
      return result;
    } catch (e) {
      await dismissLoading();
      const friendly = describeDbError(e, t);
      toast(friendly ?? opts.error ?? (e as Error).message ?? t('common.error'), 'danger');
      return undefined;
    }
  };

  return { toast, run };
}
