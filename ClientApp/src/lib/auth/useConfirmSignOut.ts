import { useTranslation } from 'react-i18next';
import { useConfirm } from '../../components/ui/useConfirm';
import { useAuth } from './AuthContext';

/** Returns a handler that asks for confirmation before signing the user out. */
export function useConfirmSignOut(): () => Promise<void> {
  const { signOut } = useAuth();
  const confirm = useConfirm();
  const { t } = useTranslation();

  return async () => {
    const ok = await confirm({
      header: t('common.logout'),
      message: t('auth.logoutConfirm'),
      confirmText: t('common.logout'),
      danger: true,
    });
    if (ok) await signOut();
  };
}
