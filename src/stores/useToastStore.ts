import { create } from 'zustand';

export type ToastKind = 'success' | 'error' | 'info';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface Toast {
  id: string;
  kind: ToastKind;
  title: string;
  message?: string;
  action?: ToastAction;
}

interface ToastState {
  toasts: Toast[];
  push: (toast: Omit<Toast, 'id'>, durationMs?: number) => string;
  dismiss: (id: string) => void;
}

const MAX_VISIBLE_TOASTS = 4;

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],

  push: (toast, durationMs) => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }].slice(-MAX_VISIBLE_TOASTS) }));
    const timeout = durationMs ?? (toast.kind === 'error' ? 9000 : 5000);
    setTimeout(() => get().dismiss(id), timeout);
    return id;
  },

  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

export const toast = {
  success: (title: string, message?: string, action?: ToastAction) =>
    useToastStore.getState().push({ kind: 'success', title, message, action }),
  error: (title: string, message?: string) =>
    useToastStore.getState().push({ kind: 'error', title, message }),
  info: (title: string, message?: string, action?: ToastAction) =>
    useToastStore.getState().push({ kind: 'info', title, message, action }),
};
