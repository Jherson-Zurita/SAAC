import { create } from 'zustand';
import type { AiStatusResult } from '../../shared/types';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  isMockFallback?: boolean;
  tokensUsed?: number;
}

interface AiState {
  messages: ChatMessage[];
  isThinking: boolean;
  aiStatus: AiStatusResult | null;

  addMessage: (
    sender: 'user' | 'assistant',
    text: string,
    meta?: { isMockFallback?: boolean; tokensUsed?: number }
  ) => void;
  setIsThinking: (isThinking: boolean) => void;
  setAiStatus: (status: AiStatusResult | null) => void;
  clearChat: () => void;
}

export const useAiStore = create<AiState>((set) => ({
  messages: [],
  isThinking: false,
  aiStatus: null,

  addMessage: (sender, text, meta) =>
    set((state) => ({
      messages: [
        ...state.messages,
        {
          id: `msg-${Date.now()}-${Math.random()}`,
          sender,
          text,
          timestamp: new Date().toLocaleTimeString(),
          isMockFallback: meta?.isMockFallback,
          tokensUsed: meta?.tokensUsed,
        },
      ],
    })),

  setIsThinking: (isThinking) => set({ isThinking }),
  setAiStatus: (aiStatus) => set({ aiStatus }),
  clearChat: () => set({ messages: [] }),
}));
