import { create } from 'zustand';
import { readStore, removeStore, writeStore } from '../lib/storage';
import { clearApiCache, setApiBase } from '../api/client';
import { clearRequestCache } from '../hooks/useRequest';
import type { Song } from '../api/types';
import { QUALITY_ORDER } from '../api/normalize';
import type { PlayerMode } from './player';

const KEY = 'mpp.settings.v1';
/** 播放队列单独存一个 key：队列可能有几百首，不能让它跟着每次设置写入一起序列化 */
const KEY_QUEUE = 'mpp.lastPlayed.v1';

/** 队列最多记忆多少首（够覆盖常见歌单，同时避免 localStorage 过大） */
export const QUEUE_MEMORY_LIMIT = 1000;

export interface LastPlayed {
  song: Song;
  queue: Song[];
  index: number;
  time: number;
  at: number;
  /** 播放方式，跟着队列一起恢复 */
  mode?: PlayerMode;
  /** 播放来源（歌单名 / 专辑名…） */
  context?: string;
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
  /** 播放方式：列表循环 / 单曲循环 / 随机 / 顺序，随设置持久化 */
  playMode: PlayerMode;
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
  setPlayMode: (v: PlayerMode) => void;
  setLyricAlign: (v: 'center' | 'left') => void;
  setSignResult: (date: string, status: '' | 'success' | 'already' | 'blocked' | 'failed', message: string) => void;
  setUpgradeResult: (date: string, status: '' | 'success' | 'already' | 'blocked' | 'failed', message: string) => void;
}

interface Persisted {
  apiBase: string;
  onboarded: boolean;
  quality: string;
  recentSearches: string[];
  showLyricTranslation: boolean;
  startupVolume: number;
  autoSign: boolean;
  playMode: PlayerMode;
  lyricAlign: 'center' | 'left';
  lastSignDate: string;
  lastSignStatus: '' | 'success' | 'already' | 'blocked' | 'failed';
  lastUpgradeDate: string;
  lastUpgradeStatus: '' | 'success' | 'already' | 'blocked' | 'failed';
  lastUpgradeMessage: string;
  lastSignMessage: string;
}

const MODES: PlayerMode[] = ['repeat', 'single', 'shuffle', 'order'];

const defaults: Persisted = {
  // 开发环境下直接连本机 API，方便调试；正式构建首次启动进入引导页
  apiBase: import.meta.env.DEV ? 'http://127.0.0.1:3000' : '',
  onboarded: true,
  quality: '320',
  recentSearches: [],
  showLyricTranslation: false,
  startupVolume: 1,
  autoSign: true,
  playMode: 'repeat',
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
  if (!MODES.includes(merged.playMode)) merged.playMode = 'repeat';
  return merged;
}

/** 恢复的队列做一次体检：index 越界时按 hash 找，找不到就把当前歌曲放回队列 */
function normalizeLastPlayed(v: Partial<LastPlayed> | null | undefined): LastPlayed | null {
  if (!v || !v.song) return null;
  const queue = Array.isArray(v.queue) ? v.queue.filter((s) => s && s.hash) : [];
  let index = Number.isInteger(v.index) ? (v.index as number) : 0;
  if (!queue.length) {
    queue.push(v.song);
    index = 0;
  } else if (!queue[index]) {
    const found = queue.findIndex((s) => s.hash === v.song!.hash);
    if (found >= 0) {
      index = found;
    } else {
      queue.unshift(v.song);
      index = 0;
    }
  }
  return {
    song: queue[index] ?? v.song,
    queue: queue.slice(0, QUEUE_MEMORY_LIMIT),
    index: Math.max(0, Math.min(index, Math.min(queue.length, QUEUE_MEMORY_LIMIT) - 1)),
    time: Number.isFinite(v.time) ? Math.max(0, v.time as number) : 0,
    at: Number.isFinite(v.at) ? (v.at as number) : Date.now(),
    mode: v.mode && MODES.includes(v.mode) ? v.mode : undefined,
    context: typeof v.context === 'string' ? v.context : undefined,
  };
}

function loadLastPlayed(): LastPlayed | null {
  const own = normalizeLastPlayed(readStore<LastPlayed | null>(KEY_QUEUE, null));
  if (own) return own;
  // 兼容旧版本：队列曾经跟着设置一起存
  const legacy = readStore<{ lastPlayed?: LastPlayed | null }>(KEY, {});
  const migrated = normalizeLastPlayed(legacy.lastPlayed);
  if (migrated) {
    writeStore(KEY_QUEUE, migrated);
    const { lastPlayed: _drop, ...rest } = legacy as Record<string, unknown>;
    writeStore(KEY, rest);
  }
  return migrated;
}

const initial = load();
const initialLastPlayed = loadLastPlayed();

/** 只把「设置」写进设置 key，队列不会跟着重写 */
function persistSettings(state: SettingsState) {
  const snapshot: Persisted = {
    apiBase: state.apiBase,
    onboarded: state.onboarded,
    quality: state.quality,
    recentSearches: state.recentSearches,
    showLyricTranslation: state.showLyricTranslation,
    startupVolume: state.startupVolume,
    autoSign: state.autoSign,
    playMode: state.playMode,
    lyricAlign: state.lyricAlign,
    lastSignDate: state.lastSignDate,
    lastSignStatus: state.lastSignStatus,
    lastSignMessage: state.lastSignMessage,
    lastUpgradeDate: state.lastUpgradeDate,
    lastUpgradeStatus: state.lastUpgradeStatus,
    lastUpgradeMessage: state.lastUpgradeMessage,
  };
  writeStore(KEY, snapshot);
}

// 模块加载即注入 API 地址，避免首屏请求早于 store 初始化
setApiBase(initial.apiBase);

export const useSettings = create<SettingsState>((set, get) => ({
  ...initial,
  lastPlayed: initialLastPlayed,
  init: () => {
    setApiBase(get().apiBase);
  },
  setApiBase: (base) => {
    set({ apiBase: base });
    persistSettings(get());
    setApiBase(base);
    clearApiCache();
    clearRequestCache();
  },
  completeOnboard: (base) => {
    set({ apiBase: base, onboarded: true });
    persistSettings(get());
    setApiBase(base);
    clearApiCache();
    clearRequestCache();
  },
  setQuality: (quality) => {
    set({ quality });
    persistSettings(get());
  },
  pushSearch: (word) => {
    const w = word.trim();
    if (!w) return;
    set({ recentSearches: [w, ...get().recentSearches.filter((x) => x !== w)].slice(0, 12) });
    persistSettings(get());
  },
  clearSearches: () => {
    set({ recentSearches: [] });
    persistSettings(get());
  },
  setLastPlayed: (lastPlayed) => {
    if (lastPlayed) writeStore(KEY_QUEUE, lastPlayed);
    else removeStore(KEY_QUEUE);
    set({ lastPlayed });
  },
  setAutoSign: (autoSign) => {
    set({ autoSign });
    persistSettings(get());
  },
  setPlayMode: (playMode) => {
    set({ playMode });
    persistSettings(get());
  },
  setLyricAlign: (lyricAlign) => {
    set({ lyricAlign });
    persistSettings(get());
  },
  setSignResult: (lastSignDate, lastSignStatus, lastSignMessage) => {
    set({ lastSignDate, lastSignStatus, lastSignMessage });
    persistSettings(get());
  },
  setUpgradeResult: (lastUpgradeDate, lastUpgradeStatus, lastUpgradeMessage) => {
    set({ lastUpgradeDate, lastUpgradeStatus, lastUpgradeMessage });
    persistSettings(get());
  },
}));
