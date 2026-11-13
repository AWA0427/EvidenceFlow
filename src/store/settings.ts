import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemeMode = 'light' | 'dark' | 'system' | 'custom';

export interface SettingsState {
  mode: ThemeMode;
  accent: string;
  customBg: string;
  customSurface: string;
  fontScale: number;
  reducedMotion: boolean;
  highContrast: boolean;
  apiBase: string;
  model: string;
  temperature: number;
  setMode: (mode: ThemeMode) => void;
  setAccent: (accent: string) => void;
  setCustomBg: (color: string) => void;
  setCustomSurface: (color: string) => void;
  setFontScale: (scale: number) => void;
  setReducedMotion: (value: boolean) => void;
  setHighContrast: (value: boolean) => void;
  setApiBase: (value: string) => void;
  setModel: (value: string) => void;
  setTemperature: (value: number) => void;
  resetAppearance: () => void;
}

const APPEARANCE_DEFAULTS = {
  mode: 'light' as ThemeMode,
  accent: '#2e6b34',
  customBg: '#f7fbf3',
  customSurface: '#ffffff',
  fontScale: 1,
  reducedMotion: false,
  highContrast: false,
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...APPEARANCE_DEFAULTS,
      apiBase: 'https://api.deepseek.com',
      model: 'deepseek-chat',
      temperature: 0.2,
      setMode: (mode) => set({ mode }),
      setAccent: (accent) => set({ accent }),
      setCustomBg: (customBg) => set({ customBg }),
      setCustomSurface: (customSurface) => set({ customSurface }),
      setFontScale: (fontScale) => set({ fontScale }),
      setReducedMotion: (reducedMotion) => set({ reducedMotion }),
      setHighContrast: (highContrast) => set({ highContrast }),
      setApiBase: (apiBase) => set({ apiBase }),
      setModel: (model) => set({ model }),
      setTemperature: (temperature) => set({ temperature }),
      resetAppearance: () => set({ ...APPEARANCE_DEFAULTS }),
    }),
    {
      name: 'evidenceflow-settings',
      version: 2,
      migrate: (persisted) => {
        const state = persisted as Partial<SettingsState>;
        // v1 的默认是朱砂/系统色；升级到 Material 3 绿色默认值
        if (!state.accent || state.accent === '#c2410c') state.accent = '#2e6b34';
        if (!state.mode || state.mode === 'system') state.mode = 'light';
        if (!state.customBg || state.customBg === '#f3efe6') state.customBg = '#f7fbf3';
        if (!state.customSurface || state.customSurface === '#fffdf8') state.customSurface = '#ffffff';
        return state as SettingsState;
      },
      partialize: (state) => ({
        mode: state.mode,
        accent: state.accent,
        customBg: state.customBg,
        customSurface: state.customSurface,
        fontScale: state.fontScale,
        reducedMotion: state.reducedMotion,
        highContrast: state.highContrast,
        apiBase: state.apiBase,
        model: state.model,
        temperature: state.temperature,
      }),
    },
  ),
);
