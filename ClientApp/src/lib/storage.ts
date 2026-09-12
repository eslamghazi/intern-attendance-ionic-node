// Session storage adapter backed by Capacitor Preferences so the auth
// sessions survive app restarts on native. On the web, Preferences falls back
// to localStorage automatically, so this works in the browser too.
import { Preferences } from '@capacitor/preferences';

export const capacitorStorage = {
  getItem: async (key: string): Promise<string | null> => {
    const { value } = await Preferences.get({ key });
    return value ?? null;
  },
  setItem: async (key: string, value: string): Promise<void> => {
    await Preferences.set({ key, value });
  },
  removeItem: async (key: string): Promise<void> => {
    await Preferences.remove({ key });
  },
};
