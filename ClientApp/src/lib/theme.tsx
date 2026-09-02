import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';
const KEY = 'theme';

interface ThemeValue {
  mode: ThemeMode;
  isDark: boolean;
  setMode: (m: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeValue | undefined>(undefined);

function prefersDark(): boolean {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
}
function computeDark(mode: ThemeMode): boolean {
  return mode === 'dark' || (mode === 'system' && prefersDark());
}
function applyDark(dark: boolean): void {
  document.documentElement.classList.toggle('ion-palette-dark', dark);
  // Pin the native UA color-scheme to the app theme so native controls
  // (time/date picker icons, scrollbars) match — not the OS preference.
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const initial = ((typeof localStorage !== 'undefined' && localStorage.getItem(KEY)) ||
    'system') as ThemeMode;
  const [mode, setModeState] = useState<ThemeMode>(initial);
  const [isDark, setIsDark] = useState<boolean>(() => computeDark(initial));

  useEffect(() => {
    const dark = computeDark(mode);
    setIsDark(dark);
    applyDark(dark);
    try {
      localStorage.setItem(KEY, mode);
    } catch {
      /* ignore */
    }
    if (mode === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = () => {
        const d = mq.matches;
        setIsDark(d);
        applyDark(d);
      };
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }
  }, [mode]);

  return (
    <ThemeContext.Provider value={{ mode, isDark, setMode: setModeState }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
