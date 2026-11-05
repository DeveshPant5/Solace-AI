import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Appearance, Platform } from 'react-native';

import { storage } from '@/lib/storage';

/** Light is the default: Solace should feel like a warm, sunlit room. */
export type ThemeMode = 'light' | 'dark' | 'system';

const KEY = 'solace.appearance';

interface ThemeModeState {
  mode: ThemeMode;
  loaded: boolean;
  setMode(mode: ThemeMode): void;
}

export const ThemeModeContext = createContext<ThemeModeState>({ mode: 'light', loaded: true, setMode: () => undefined });

/** Tell the native side too, so system dialogs and the keyboard match the app. */
function applyNative(mode: ThemeMode) {
  if (Platform.OS === 'web') return;
  try {
    Appearance.setColorScheme(mode === 'system' ? 'unspecified' : mode);
  } catch {
    // Older runtimes: the app palette still follows the chosen mode.
  }
}

export function ThemeModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('light');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void storage.get(KEY).then((saved) => {
      const next: ThemeMode = saved === 'dark' || saved === 'system' ? saved : 'light';
      setModeState(next);
      applyNative(next);
      setLoaded(true);
    });
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    applyNative(next);
    void storage.set(KEY, next);
  }, []);

  const value = useMemo(() => ({ mode, loaded, setMode }), [mode, loaded, setMode]);
  return <ThemeModeContext.Provider value={value}>{children}</ThemeModeContext.Provider>;
}

export function useThemeMode() {
  return useContext(ThemeModeContext);
}
