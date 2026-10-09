import { create } from 'zustand';
import type { AiStatusResult } from '../../shared/types';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  isMockFallback?: boolean;
  tokensUsed?: number;
  isStreaming?: boolean;
  cancelled?: boolean;
}

type MessageMeta = Pick<ChatMessage, 'isMockFallback' | 'tokensUsed' | 'isStreaming' | 'cancelled'>;

interface AiState {
  messages: ChatMessage[];
  isThinking: boolean;
  aiStatus: AiStatusResult | null;

  /** Devuelve el id del mensaje creado. */
  addMessage: (sender: 'user' | 'assistant', text: string, meta?: MessageMeta) => string;
  appendToMessage: (id: string, text: string) => void;
  updateMessage: (id: string, patch: Partial<Omit<ChatMessage, 'id' | 'sender'>>) => void;
  setIsThinking: (isThinking: boolean) => void;
  setAiStatus: (status: AiStatusResult | null) => void;
  clearChat: () => void;
}

export const useAiStore = create<AiState>((set) => ({
  messages: [],
  isThinking: false,
  aiStatus: null,

  addMessage: (sender, text, meta) => {
    const id = `msg-${Date.now()}-${Math.random()}`;
    set((state) => ({
      messages: [
        ...state.messages,
        {
          id,
          sender,
          text,
          timestamp: new Date().toLocaleTimeString(),
          ...meta,
        },
      ],
    }));
    return id;
  },

  appendToMessage: (id, text) =>
    set((state) => ({
      messages: state.messages.map((m) => (m.id === id ? { ...m, text: m.text + text } : m)),
    })),

  updateMessage: (id, patch) =>
    set((state) => ({
      messages: state.messages.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    })),

  setIsThinking: (isThinking) => set({ isThinking }),
  setAiStatus: (aiStatus) => set({ aiStatus }),
  clearChat: () => set({ messages: [] }),
}));
