import {
  createContext, useCallback, useContext, useMemo,
} from 'react';
import { useLocalStorage } from '@/hooks/utils/use-local-storage';

/**
 * App-wide preferences that are saved between launches.
 */
interface PreferencesState {
  /** Voice volume, 0-100 */
  volume: number
  setVolume: (value: number) => void
  /** Turn the mic on when the app connects to the server */
  micOnStartup: boolean
  setMicOnStartup: (value: boolean) => void
  /** Saved pet-mode size per model url, as a multiple of the model's default size */
  petScales: Record<string, number>
  setPetScale: (modelUrl: string, ratio: number | null) => void
}

const PreferencesContext = createContext<PreferencesState | null>(null);

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [volume, setVolume] = useLocalStorage<number>('voiceVolume', 100);
  const [micOnStartup, setMicOnStartup] = useLocalStorage<boolean>('micOnStartup', true);
  const [petScales, setPetScales] = useLocalStorage<Record<string, number>>('petModelScales', {});

  const setPetScale = useCallback((modelUrl: string, ratio: number | null) => {
    setPetScales((current) => {
      const next = { ...current };
      if (ratio === null) delete next[modelUrl];
      else next[modelUrl] = ratio;
      return next;
    });
  }, [setPetScales]);

  const value = useMemo(() => ({
    volume,
    setVolume,
    micOnStartup,
    setMicOnStartup,
    petScales,
    setPetScale,
  }), [volume, micOnStartup, petScales, setPetScale]);

  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error('usePreferences must be used within a PreferencesProvider');
  }
  return context;
}
