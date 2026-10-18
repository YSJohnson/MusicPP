import { create } from 'zustand';
import { getLyric, resolveSongUrl } from '../api';
import { AuthRequiredError } from '../api/client';
import type { Lyric, Song } from '../api/types';
import { useSettings } from './settings';
import { setBackgroundAudio } from '../lib/backgroundAudio';
import { useToast } from './toast';

export type PlayerMode = 'repeat' | 'single' | 'shuffle' | 'order';

export const MODE_META: Record<PlayerMode, { label: string; icon: string }> = {
  repeat: { label: '列表循环', icon: 'repeat' },
  single: { label: '单曲循环', icon: 'single' },
  shuffle: { label: '随机播放', icon: 'shuffle' },
  order: { label: '顺序播放', icon: 'order' },
};

let audioEl: HTMLAudioElement | null = null;

function getAudio(): HTMLAudioElement | null {
  if (typeof window === 'undefined') return null;
  if (!audioEl) {
    audioEl = new Audio();
    audioEl.preload = 'auto';
    // 注意：不要设置 crossOrigin —— 酷狗 CDN 不返回 CORS 头，
    // 一旦声明匿名跨域，音频会直接加载失败
    (audioEl as any).playsInline = true;
  }
  return audioEl;
}

interface PlayerState {
  queue: Song[];
  index: number;
  playing: boolean;
  loading: boolean;
  buffering: boolean;
  time: number;
  duration: number;
  mode: PlayerMode;
  quality: string;
  resolvedQuality: string;
  lyric: Lyric | null;
  lyricLoading: boolean;
  /** 已尝试加载过歌词的歌曲 hash，避免重复请求 */
  lyricHash: string;
  loadLyric: () => Promise<void>;
  error: string | null;
  context: string;
  queueOpen: boolean;

  current: () => Song | undefined;
  playQueue: (songs: Song[], startIndex?: number, context?: string) => Promise<void>;
  playSong: (song: Song, queue?: Song[], context?: string) => Promise<void>;
  playAt: (index: number) => Promise<void>;
  loadCurrent: () => Promise<void>;
  toggle: (force?: boolean) => Promise<void>;
  next: (auto?: boolean) => Promise<void>;
  prev: () => Promise<void>;
  seek: (time: number) => void;
  setMode: (mode?: PlayerMode) => void;
  cycleMode: () => void;
  setQuality: (q: string) => Promise<void>;
  appendQueue: (songs: Song[]) => void;
  insertNext: (song: Song) => void;
  removeAt: (index: number) => void;
  clearQueue: () => void;
  setQueueOpen: (open: boolean) => void;
  onEnded: () => void;
  stop: () => void;
}

const persistLast = (state: PlayerState) => {
  const song = state.queue[state.index];
  if (!song) return;
  useSettings.getState().setLastPlayed({
    song,
    queue: state.queue.slice(0, 80),
    index: state.index,
    time: getAudio()?.currentTime ?? 0,
    at: Date.now(),
  });
};

let lastPersist = 0;

function updateMediaSession(song?: Song) {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator) || !song) return;
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: song.name,
      artist: song.artist,
      album: song.album,
      artwork: song.cover ? [{ src: song.cover, sizes: '480x480', type: 'image/jpeg' }] : [],
    });
  } catch {
    /* ignore */
  }
}

// 启动时恢复上次播放的队列与进度（暂停态），底栏中间的圆形封面可以直接续播
const restored = useSettings.getState().lastPlayed;

export const usePlayer = create<PlayerState>((set, get) => ({
  queue: restored?.queue ?? [],
  index: restored?.index ?? 0,
  playing: false,
  loading: false,
  buffering: false,
  time: restored?.time ?? 0,
  duration: restored?.song?.duration ?? 0,
  mode: 'repeat',
  quality: useSettings.getState().quality,
  resolvedQuality: '',
  lyric: null,
  lyricLoading: false,
  lyricHash: '',
  error: null,
  context: '',
  queueOpen: false,

  current: () => get().queue[get().index],

  playQueue: async (songs, startIndex = 0, context = '播放列表') => {
    if (!songs.length) return;
    const index = Math.max(0, Math.min(startIndex, songs.length - 1));
    set({
      queue: songs,
      index,
      context,
      lyric: null,
      time: 0,
      duration: songs[index]?.duration ?? 0,
    });
    await get().loadCurrent();
  },

  playSong: async (song, queue, context) => {
    const list = queue && queue.length ? queue : [song];
    const idx = Math.max(
      0,
      list.findIndex((s) => s.hash === song.hash),
    );
    await get().playQueue(list, idx, context ?? '单曲播放');
  },

  playAt: async (index) => {
    const { queue } = get();
    if (index < 0 || index >= queue.length) return;
    set({ index });
    await get().loadCurrent();
  },

  loadCurrent: async () => {
    const state = get();
    const song = state.queue[state.index];
    const audio = getAudio();
    if (!song || !audio) return;

    set({
      loading: true,
      error: null,
      time: 0,
      duration: song.duration || 0,
      lyric: null,
      buffering: true,
    });

    // 歌词与播放地址无关，先并行拉取，避免无版权/未登录时歌词也一起消失
    void (async () => {
      set({ lyricLoading: true, lyric: null });
      const lyric = await getLyric(song);
      const stillSame = get().queue[get().index]?.hash === song.hash;
      set({ lyric: stillSame ? lyric : get().lyric, lyricLoading: false, lyricHash: song.hash });
    })();

    try {
      const { url, quality } = await resolveSongUrl(song, state.quality);
      audio.src = url;
      audio.load();
      try {
        await audio.play();
      } catch {
        /* 自动播放被拦截时保持暂停 */
      }
      set({
        loading: false,
        buffering: false,
        playing: !audio.paused,
        resolvedQuality: quality,
        error: null,
      });
      updateMediaSession(song);
      persistLast(get());
    } catch (err) {
      const isAuth = err instanceof AuthRequiredError;
      const message = err instanceof Error ? err.message : '播放失败';
      set({ loading: false, buffering: false, playing: false, error: message });
      useToast
        .getState()
        .show(isAuth ? '这首歌需要登录后才能播放' : message, isAuth ? 'warn' : 'error');
    }
  },

  loadLyric: async () => {
    const song = get().queue[get().index];
    if (!song || get().lyricLoading) return;
    const hash = song.hash;
    set({ lyricLoading: true });
    try {
      const lyric = await getLyric(song);
      const same = get().queue[get().index]?.hash === hash;
      set({
        lyric: same ? lyric : get().lyric,
        lyricLoading: false,
        lyricHash: hash,
      });
    } catch {
      set({ lyricLoading: false, lyricHash: hash });
    }
  },

  toggle: async (force) => {
    const audio = getAudio();
    if (!audio) return;
    const want = force ?? !get().playing;
    if (want) {
      if (!audio.src) {
        // 从上次进度继续播放
        const resumeAt = get().time;
        await get().loadCurrent();
        if (resumeAt > 3 && (!get().duration || resumeAt < get().duration - 3)) {
          const apply = () => {
            try {
              audio.currentTime = resumeAt;
              set({ time: resumeAt });
            } catch {
              /* ignore */
            }
            audio.removeEventListener('loadedmetadata', apply);
          };
          if (audio.readyState >= 1) apply();
          else audio.addEventListener('loadedmetadata', apply);
        }
        return;
      }
      try {
        await audio.play();
      } catch {
        set({ playing: false });
      }
    } else {
      audio.pause();
    }
  },

  next: async (auto = false) => {
    const { queue, index, mode } = get();
    if (!queue.length) return;
    let nextIndex = index + 1;
    if (mode === 'shuffle') {
      nextIndex = queue.length === 1 ? 0 : Math.floor(Math.random() * queue.length);
    }
    if (nextIndex >= queue.length) {
      if (mode === 'order' && auto) {
        getAudio()?.pause();
        set({ playing: false });
        return;
      }
      nextIndex = 0;
    }
    set({ index: nextIndex });
    await get().loadCurrent();
  },

  prev: async () => {
    const audio = getAudio();
    const { index } = get();
    if (audio && audio.currentTime > 4) {
      audio.currentTime = 0;
      return;
    }
    const prevIndex = index - 1 < 0 ? get().queue.length - 1 : index - 1;
    set({ index: prevIndex });
    await get().loadCurrent();
  },

  seek: (time) => {
    const audio = getAudio();
    if (!audio) return;
    if (Number.isFinite(time)) {
      audio.currentTime = Math.max(0, time);
      set({ time });
    }
  },

  setMode: (mode) => {
    if (mode) {
      set({ mode });
      return;
    }
    get().cycleMode();
  },

  cycleMode: () => {
    const order: PlayerMode[] = ['repeat', 'single', 'shuffle', 'order'];
    const idx = order.indexOf(get().mode);
    const mode = order[(idx + 1) % order.length];
    set({ mode });
    useToast.getState().show(MODE_META[mode].label, 'info');
  },

  setQuality: async (q) => {
    useSettings.getState().setQuality(q);
    set({ quality: q });
    if (get().queue.length) await get().loadCurrent();
  },

  appendQueue: (songs) => {
    if (!songs.length) return;
    const exists = new Set(get().queue.map((s) => s.hash));
    const next = [...get().queue, ...songs.filter((s) => !exists.has(s.hash))];
    set({ queue: next });
    useToast.getState().show(`已添加 ${songs.length} 首到播放列表`, 'success');
  },

  insertNext: (song) => {
    const { queue, index } = get();
    const filtered = queue.filter((s) => s.hash !== song.hash);
    const at = queue.length ? Math.min(index + 1, filtered.length) : 0;
    const next = [...filtered.slice(0, at), song, ...filtered.slice(at)];
    set({ queue: next, index: queue.length ? Math.min(index, next.length - 1) : 0 });
  },

  removeAt: (index) => {
    const { queue, index: current } = get();
    if (index < 0 || index >= queue.length) return;
    const next = queue.filter((_, i) => i !== index);
    if (!next.length) {
      set({ queue: [], index: 0, playing: false });
      getAudio()?.pause();
      return;
    }
    let nextIndex = current;
    if (index < current) nextIndex = current - 1;
    if (index === current) {
      set({ queue: next, index: Math.min(nextIndex, next.length - 1) });
      void get().loadCurrent();
      return;
    }
    set({ queue: next, index: Math.min(nextIndex, next.length - 1) });
  },

  clearQueue: () => {
    getAudio()?.pause();
    getAudio()?.removeAttribute('src');
    set({ queue: [], index: 0, playing: false, time: 0, duration: 0, lyric: null, error: null });
  },

  setQueueOpen: (queueOpen) => set({ queueOpen }),

  onEnded: () => {
    const { mode } = get();
    if (mode === 'single') {
      const audio = getAudio();
      if (audio) {
        audio.currentTime = 0;
        void audio.play();
      }
      return;
    }
    void get().next(true);
  },

  stop: () => {
    getAudio()?.pause();
    set({ playing: false });
  },
}));

/** 绑定音频事件 */
(function bindAudio() {
  const audio = getAudio();
  if (!audio) return;

  audio.addEventListener('timeupdate', () => {
    usePlayer.setState({ time: audio.currentTime });
    const now = Date.now();
    if (now - lastPersist > 5000) {
      lastPersist = now;
      persistLast(usePlayer.getState());
    }
  });

  audio.addEventListener('durationchange', () => {
    usePlayer.setState({ duration: Number.isFinite(audio.duration) ? audio.duration : 0 });
  });

  audio.addEventListener('playing', () => {
    usePlayer.setState({ playing: true, loading: false, buffering: false, error: null });
    setBackgroundAudio(true);
  });

  audio.addEventListener('pause', () => {
    usePlayer.setState({ playing: false });
    setBackgroundAudio(false);
  });

  audio.addEventListener('waiting', () => {
    usePlayer.setState({ buffering: true });
  });

  audio.addEventListener('canplay', () => {
    usePlayer.setState({ buffering: false });
  });

  audio.addEventListener('ended', () => usePlayer.getState().onEnded());

  audio.addEventListener('error', () => {
    const state = usePlayer.getState();
    if (!audio.src) return;
    usePlayer.setState({ playing: false, buffering: false, loading: false });
    if (state.queue.length) {
      useToast.getState().show('音频加载失败，正在尝试下一首', 'warn');
      window.setTimeout(() => void usePlayer.getState().next(true), 900);
    }
  });

  if ('mediaSession' in navigator) {
    try {
      navigator.mediaSession.setActionHandler('play', () => void usePlayer.getState().toggle(true));
      navigator.mediaSession.setActionHandler('pause', () => void usePlayer.getState().toggle(false));
      navigator.mediaSession.setActionHandler('nexttrack', () => void usePlayer.getState().next());
      navigator.mediaSession.setActionHandler('previoustrack', () => void usePlayer.getState().prev());
    } catch {
      /* ignore */
    }
  }
})();
