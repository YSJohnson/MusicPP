import { create } from 'zustand';

export type ToastType = 'info' | 'success' | 'warn' | 'error';

export interface ToastItem {
  id: number;
  text: string;
  type: ToastType;
}

interface ToastStore {
  toasts: ToastItem[];
  show: (text: string, type?: ToastType) => void;
  dismiss: (id: number) => void;
}

let seed = 0;

export const useToast = create<ToastStore>((set, get) => ({
  toasts: [],
  show: (text, type = 'info') => {
    const id = ++seed;
    set({ toasts: [...get().toasts.slice(-2), { id, text, type }] });
    window.setTimeout(() => get().dismiss(id), 2400);
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));
