import { create } from 'zustand';
import type { AnalysisHistory, AMGDelta } from '../../shared/types';

interface AnalysisHistoryState {
  history: AnalysisHistory | null;
  selectedDelta: AMGDelta | null;
  isLoadingHistory: boolean;

  setHistory: (history: AnalysisHistory | null) => void;
  setSelectedDelta: (delta: AMGDelta | null) => void;
  setIsLoadingHistory: (isLoading: boolean) => void;
}

export const useAnalysisHistoryStore = create<AnalysisHistoryState>((set) => ({
  history: null,
  selectedDelta: null,
  isLoadingHistory: false,

  setHistory: (history) => set({ history }),
  setSelectedDelta: (selectedDelta) => set({ selectedDelta }),
  setIsLoadingHistory: (isLoadingHistory) => set({ isLoadingHistory }),
}));
