import {
  createContext, useContext, ReactNode, useEffect, useRef, useCallback, useMemo,
} from 'react';
import { useLocalStorage } from '@/hooks/utils/use-local-storage';
import { useTriggerSpeak } from '@/hooks/utils/use-trigger-speak';
import { useAiState, AiStateEnum } from '@/context/ai-state-context';
import { useScreenCaptureContext } from '@/context/screen-capture-context';

interface ProactiveSpeakSettings {
  allowButtonTrigger: boolean;
  allowProactiveSpeak: boolean
  idleSecondsToSpeak: number
  // While screen capture is on, speak up on her own at random times.
  randomSpeakOnScreenShare: boolean
  randomMinMinutes: number
  randomMaxMinutes: number
}

interface ProactiveSpeakContextType {
  settings: ProactiveSpeakSettings
  updateSettings: (newSettings: ProactiveSpeakSettings) => void
}

export const defaultProactiveSpeakSettings: ProactiveSpeakSettings = {
  allowProactiveSpeak: false,
  idleSecondsToSpeak: 5,
  allowButtonTrigger: false,
  randomSpeakOnScreenShare: true,
  randomMinMinutes: 0.5,
  randomMaxMinutes: 8,
};

// First remark after screen capture starts comes quickly, so it's clear it works.
const FIRST_REMARK_SECONDS: [number, number] = [20, 45];

function randomSeconds(min: number, max: number): number {
  const lo = Math.max(0, Math.min(min, max));
  const hi = Math.max(min, max);
  return lo + Math.random() * (hi - lo);
}

export const ProactiveSpeakContext = createContext<ProactiveSpeakContextType | null>(null);

export function ProactiveSpeakProvider({ children }: { children: ReactNode }) {
  const [storedSettings, setSettings] = useLocalStorage<ProactiveSpeakSettings>(
    'proactiveSpeakSettings',
    defaultProactiveSpeakSettings,
  );
  // Older saved settings don't have the random-speak fields yet.
  const settings = useMemo(
    () => ({ ...defaultProactiveSpeakSettings, ...storedSettings }),
    [storedSettings],
  );

  const { aiState } = useAiState();
  const { sendTriggerSignal } = useTriggerSpeak();
  const { isStreaming: isScreenSharing } = useScreenCaptureContext();

  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const idleStartTimeRef = useRef<number | null>(null);
  const hasSpokenThisShareRef = useRef(false);

  const randomMode = settings.randomSpeakOnScreenShare && isScreenSharing;

  useEffect(() => {
    if (!isScreenSharing) hasSpokenThisShareRef.current = false;
  }, [isScreenSharing]);

  const clearIdleTimer = useCallback(() => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
    idleStartTimeRef.current = null;
  }, []);

  const startIdleTimer = useCallback(() => {
    clearIdleTimer();

    let delaySeconds: number;
    if (randomMode) {
      delaySeconds = hasSpokenThisShareRef.current
        ? randomSeconds(settings.randomMinMinutes * 60, settings.randomMaxMinutes * 60)
        : randomSeconds(...FIRST_REMARK_SECONDS);
    } else if (settings.allowProactiveSpeak) {
      delaySeconds = settings.idleSecondsToSpeak;
    } else {
      return;
    }

    idleStartTimeRef.current = Date.now();
    idleTimerRef.current = setTimeout(() => {
      const actualIdleTime = (Date.now() - idleStartTimeRef.current!) / 1000;
      if (randomMode) hasSpokenThisShareRef.current = true;
      // Captures a fresh screenshot (and camera frame, if on) and sends it with the signal.
      sendTriggerSignal(actualIdleTime);
    }, delaySeconds * 1000);
  }, [
    randomMode,
    settings.randomMinMinutes,
    settings.randomMaxMinutes,
    settings.allowProactiveSpeak,
    settings.idleSecondsToSpeak,
    sendTriggerSignal,
    clearIdleTimer,
  ]);

  useEffect(() => {
    if (aiState === AiStateEnum.IDLE) {
      startIdleTimer();
    } else {
      clearIdleTimer();
    }
  }, [aiState, startIdleTimer, clearIdleTimer]);

  useEffect(() => () => {
    clearIdleTimer();
  }, [clearIdleTimer]);

  const updateSettings = useCallback((newSettings: ProactiveSpeakSettings) => {
    setSettings(newSettings);
  }, [setSettings]);

  const contextValue = useMemo(() => ({
    settings,
    updateSettings,
  }), [settings, updateSettings]);

  return (
    <ProactiveSpeakContext.Provider value={contextValue}>
      {children}
    </ProactiveSpeakContext.Provider>
  );
}

export function useProactiveSpeak() {
  const context = useContext(ProactiveSpeakContext);
  if (!context) {
    throw new Error('useProactiveSpeak must be used within a ProactiveSpeakProvider');
  }
  return context;
}
