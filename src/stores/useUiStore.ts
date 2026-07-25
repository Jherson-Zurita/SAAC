import { create } from 'zustand';

export type MainTab =
  | 'dashboard'
  | 'c4'
  | 'package'
  | 'inheritance'
  | 'er'
  | 'callgraph'
  | 'sequence'
  | 'dynamic'
  | 'dfd'
  | 'metrics'
  | 'antipatterns'
  | 'adrs';

export type LeftbarTab = 'explorer' | 'navigation' | 'search';
export type DownbarTab = 'output' | 'problems' | 'history' | 'console';

interface UiState {
  theme: 'dark' | 'light';
  leftbarOpen: boolean;
  rightbarOpen: boolean;
  downbarOpen: boolean;
  activeLeftbarTab: LeftbarTab;
  activeDownbarTab: DownbarTab;
  activeMainTab: MainTab;

  setTheme: (theme: 'dark' | 'light') => void;
  toggleTheme: () => void;
  setLeftbarOpen: (open: boolean) => void;
  setRightbarOpen: (open: boolean) => void;
  setDownbarOpen: (open: boolean) => void;
  toggleLeftbar: () => void;
  toggleRightbar: () => void;
  toggleDownbar: () => void;
  setActiveLeftbarTab: (tab: LeftbarTab) => void;
  setActiveDownbarTab: (tab: DownbarTab) => void;
  setActiveMainTab: (tab: MainTab) => void;
}

export const useUiStore = create<UiState>((set) => ({
  theme: 'dark',
  leftbarOpen: true,
  rightbarOpen: true,
  downbarOpen: false,
  activeLeftbarTab: 'explorer',
  activeDownbarTab: 'output',
  activeMainTab: 'dashboard',

  setTheme: (theme) => set({ theme }),
  toggleTheme: () => set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),
  setLeftbarOpen: (leftbarOpen) => set({ leftbarOpen }),
  setRightbarOpen: (rightbarOpen) => set({ rightbarOpen }),
  setDownbarOpen: (downbarOpen) => set({ downbarOpen }),
  toggleLeftbar: () => set((state) => ({ leftbarOpen: !state.leftbarOpen })),
  toggleRightbar: () => set((state) => ({ rightbarOpen: !state.rightbarOpen })),
  toggleDownbar: () => set((state) => ({ downbarOpen: !state.downbarOpen })),
  setActiveLeftbarTab: (activeLeftbarTab) => set({ activeLeftbarTab }),
  setActiveDownbarTab: (activeDownbarTab) => set({ activeDownbarTab }),
  setActiveMainTab: (activeMainTab) => set({ activeMainTab }),
}));
