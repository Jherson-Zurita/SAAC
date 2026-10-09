import { create } from 'zustand';
import type { GlobalConfig } from '../../shared/types';
import { getGlobalConfig, updateGlobalConfig } from '../lib/tauri-api';

export const DEFAULT_GLOBAL_CONFIG: GlobalConfig = {
  aiProvider: 'ollama',
  aiEndpoint: 'http://localhost:11434',
  aiDefaultModel: 'qwen3:4b',
  maxWorkerThreads: 4,
  defaultTheme: 'dark',
  autoCheckAi: true,
  notifyOnAnalysisComplete: true,
  notifyMinDurationSecs: 10,
  reportAuthor: '',
};

export function resolveTheme(preference: GlobalConfig['defaultTheme']): 'dark' | 'light' {
  if (preference === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return preference === 'light' ? 'light' : 'dark';
}

interface SettingsState {
  config: GlobalConfig;
  loaded: boolean;
  load: () => Promise<GlobalConfig>;
  /** Persiste en `%APPDATA%/saac/global_config.json`; revierte si falla. */
  save: (patch: Partial<GlobalConfig>) => Promise<GlobalConfig>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  config: DEFAULT_GLOBAL_CONFIG,
  loaded: false,

  load: async () => {
    try {
      const loaded = await getGlobalConfig();
      const config = { ...DEFAULT_GLOBAL_CONFIG, ...loaded };
      set({ config, loaded: true });
      return config;
    } catch (err) {
      console.warn('No se pudo cargar la configuración global:', err);
      set({ loaded: true });
      return get().config;
    }
  },

  save: async (patch) => {
    const previous = get().config;
    const next = { ...previous, ...patch };
    set({ config: next });
    try {
      const saved = await updateGlobalConfig(next);
      set({ config: saved });
      return saved;
    } catch (err) {
      set({ config: previous });
      throw err;
    }
  },
}));
