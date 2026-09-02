import { IonButton } from '@ionic/react';
import { useTranslation } from 'react-i18next';

/** Toggles between Arabic and English (also flips RTL/LTR via i18n listener). */
export default function LanguageToggle() {
  const { i18n } = useTranslation();
  const next = i18n.language === 'ar' ? 'en' : 'ar';
  return (
    <IonButton fill="clear" onClick={() => i18n.changeLanguage(next)}>
      {next === 'ar' ? 'العربية' : 'EN'}
    </IonButton>
  );
}
