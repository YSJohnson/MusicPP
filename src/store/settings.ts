import { create } from 'zustand';
import { readStore, writeStore } from '../lib/storage';
import { clearApiCache, setApiBase } from '../api/client';
import { clearRequestCache } from '../hooks/useRequest';
import type { Song } from '../api/types';
import { QUALITY_ORDER } from '../api/normalize';

const KEY = 'mpp.settings.v1';

export interface LastPlayed {
  song: Song;
  queue: Song[];
  index: number;
  time: number;
  at: number;
}

interface SettingsState {
  apiBase: string;
  onboarded: boolean;
  quality: string;
  recentSearches: string[];
  lastPlayed: LastPlayed | null;
  showLyricTranslation: boolean;
  startupVolume: number;
  autoSign: boolean;
  lyricAlign: 'center' | 'left';
  lastSignDate: string;
  lastSignStatus: '' | 'success' | 'already' | 'blocked' | 'failed';
  lastUpgradeDate: string;
  lastUpgradeStatus: '' | 'success' | 'already' | 'blocked' | 'failed';
  lastUpgradeMessage: string;
  lastSignMessage: string;
  init: () => void;
  setApiBase: (base: string) => void;
  completeOnboard: (base: string) => void;
  setQuality: (q: string) => void;
  pushSearch: (word: string) => void;
  clearSearches: () => void;
  setLastPlayed: (v: LastPlayed | null) => void;
  setAutoSign: (v: boolean) => void;
  setLyricAlign: (v: 'center' | 'left') => void;
  setSignResult: (date: string, status: '' | 'success' | 'already' | 'blocked' | 'failed', message: string) => void;
  setUpgradeResult: (date: string, status: '' | 'success' | 'already' | 'blocked' | 'failed', message: string) => void;
}

interface Persisted {
  apiBase: string;
  onboarded: boolean;
  quality: string;
  recentSearches: string[];
  lastPlayed: LastPlayed | null;
  showLyricTranslation: boolean;
  startupVolume: number;
  autoSign: boolean;
  lyricAlign: 'center' | 'left';
  lastSignDate: string;
  lastSignStatus: '' | 'success' | 'already' | 'blocked' | 'failed';
  lastUpgradeDate: string;
  lastUpgradeStatus: '' | 'success' | 'already' | 'blocked' | 'failed';
  lastUpgradeMessage: string;
  lastSignMessage: string;
}

const defaults: Persisted = {
  // 开发环境下直接连本机 API，方便调试；正式构建首次启动进入引导页
  apiBase: import.meta.env.DEV ? 'http://127.0.0.1:3000' : '',
  onboarded: true,
  quality: '320',
  recentSearches: [],
  lastPlayed: null,
  showLyricTranslation: false,
  startupVolume: 1,
  autoSign: true,
  lyricAlign: 'center',
  lastSignDate: '',
  lastSignStatus: '',
  lastSignMessage: '',
  lastUpgradeDate: '',
  lastUpgradeStatus: '',
  lastUpgradeMessage: '',
};

function load(): Persisted {
  const stored = readStore<Partial<Persisted>>(KEY, {});
  const merged = { ...defaults, ...stored };
  if (!QUALITY_ORDER.includes(merged.quality)) merged.quality = '320';
  return merged;
}

const initial = load();

// 模块加载即注入 API 地址，避免首屏请求早于 store 初始化
setApiBase(initial.apiBase);

export const useSettings = create<SettingsState>((set, get) => ({
  ...initial,
  init: () => {
    setApiBase(get().apiBase);
  },
  setApiBase: (base) => {
    const list = { ...get(), apiBase: base } as Persisted;
    writeStore(KEY, list);
    setApiBase(base);
    clearApiCache();
    clearRequestCache();
    set({ apiBase: base });
  },
  completeOnboard: (base) => {
    const next = { ...get(), apiBase: base, onboarded: true } as Persisted;
    writeStore(KEY, next);
    setApiBase(base);
    clearApiCache();
    clearRequestCache();
    set({ apiBase: base, onboarded: true });
  },
  setQuality: (quality) => {
    const next = { ...get(), quality } as Persisted;
    writeStore(KEY, next);
    set({ quality });
  },
  pushSearch: (word) => {
    const w = word.trim();
    if (!w) return;
    const list = [w, ...get().recentSearches.filter((x) => x !== w)].slice(0, 12);
    const next = { ...get(), recentSearches: list } as Persisted;
    writeStore(KEY, next);
    set({ recentSearches: list });
  },
  clearSearches: () => {
    const next = { ...get(), recentSearches: [] } as Persisted;
    writeStore(KEY, next);
    set({ recentSearches: [] });
  },
  setLastPlayed: (lastPlayed) => {
    const next = { ...get(), lastPlayed } as Persisted;
    writeStore(KEY, next);
    set({ lastPlayed });
  },
  setAutoSign: (autoSign) => {
    const next = { ...get(), autoSign } as Persisted;
    writeStore(KEY, next);
    set({ autoSign });
  },
  setLyricAlign: (lyricAlign) => {
    const next = { ...get(), lyricAlign } as Persisted;
    writeStore(KEY, next);
    set({ lyricAlign });
  },
  setSignResult: (lastSignDate, lastSignStatus, lastSignMessage) => {
    const next = { ...get(), lastSignDate, lastSignStatus, lastSignMessage } as Persisted;
    writeStore(KEY, next);
    set({ lastSignDate, lastSignStatus, lastSignMessage });
  },
  setUpgradeResult: (lastUpgradeDate, lastUpgradeStatus, lastUpgradeMessage) => {
    const next = { ...get(), lastUpgradeDate, lastUpgradeStatus, lastUpgradeMessage } as Persisted;
    writeStore(KEY, next);
    set({ lastUpgradeDate, lastUpgradeStatus, lastUpgradeMessage });
  },
}));
