import { create } from 'zustand';

export type ToastType = 'info' | 'success' | 'warn' | 'error';

export interface ToastItem {
  id: number;
  text: string;
  type: ToastType;
  /** 同一组提示只保留一条（例如频繁切换播放方式），避免叠成一摞挡住页面 */
  key?: string;
}

export interface ToastOptions {
  key?: string;
  duration?: number;
}

interface ToastStore {
  toasts: ToastItem[];
  show: (text: string, type?: ToastType, options?: ToastOptions) => void;
  dismiss: (id: number) => void;
}

let seed = 0;
/** key -> 待执行的消失定时器，重复提示时重置而不是叠加 */
const timers = new Map<string, number>();
/** 同时最多显示几条（超出时丢掉最旧的） */
const MAX_TOASTS = 2;

export const useToast = create<ToastStore>((set, get) => ({
  toasts: [],
  show: (text, type = 'info', options) => {
    const key = options?.key;
    const duration = options?.duration ?? 2400;
    const id = ++seed;

    if (key) {
      const pending = timers.get(key);
      if (pending !== undefined) window.clearTimeout(pending);
      const rest = get().toasts.filter((t) => t.key !== key);
      set({ toasts: [...rest, { id, text, type, key }].slice(-MAX_TOASTS) });
    } else {
      set({ toasts: [...get().toasts.slice(-(MAX_TOASTS - 1)), { id, text, type }] });
    }

    const timer = window.setTimeout(() => {
      if (key) timers.delete(key);
      get().dismiss(id);
    }, duration);
    if (key) timers.set(key, timer);
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));
