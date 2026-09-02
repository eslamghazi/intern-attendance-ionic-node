import { useIonAlert } from '@ionic/react';
import { useTranslation } from 'react-i18next';

export interface ConfirmOptions {
  header?: string;
  message?: string;
  confirmText?: string;
  danger?: boolean;
}

/** Returns a function that shows a confirm/warning dialog and resolves to a boolean. */
export function useConfirm() {
  const [presentAlert] = useIonAlert();
  const { t } = useTranslation();

  return (opts: ConfirmOptions = {}) =>
    new Promise<boolean>((resolve) => {
      let decided = false;
      const done = (v: boolean) => {
        if (decided) return;
        decided = true;
        resolve(v);
      };
      presentAlert({
        header: opts.header ?? t('common.confirm'),
        message: opts.message,
        buttons: [
          { text: t('common.cancel'), role: 'cancel', handler: () => done(false) },
          {
            text: opts.confirmText ?? t('common.confirm'),
            role: opts.danger ? 'destructive' : undefined,
            handler: () => done(true),
          },
        ],
        onDidDismiss: () => done(false),
      });
    });
}
