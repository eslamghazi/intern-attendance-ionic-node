import { IonButton, IonIcon } from '@ionic/react';
import { contrastOutline, moon, sunny } from 'ionicons/icons';
import { useTheme, type ThemeMode } from '../lib/theme';

const ORDER: ThemeMode[] = ['system', 'light', 'dark'];
const ICON: Record<ThemeMode, string> = {
  system: contrastOutline,
  light: sunny,
  dark: moon,
};

/** Cycles system -> light -> dark. */
export default function ThemeToggle() {
  const { mode, setMode } = useTheme();
  const next = ORDER[(ORDER.indexOf(mode) + 1) % ORDER.length];
  return (
    <IonButton fill="clear" onClick={() => setMode(next)} aria-label="theme">
      <IonIcon slot="icon-only" icon={ICON[mode]} />
    </IonButton>
  );
}
