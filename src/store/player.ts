import { create } from 'zustand';
import { getLyric, resolveSongUrl } from '../api';
import { AuthRequiredError } from '../api/client';
import type { Lyric, Song } from '../api/types';
import { useSettings } from './settings';
import {
  acquireBackgroundAudio,
  releaseBackgroundAudioNow,
  releaseBackgroundAudioSoon,
} from '../lib/backgroundAudio';
import {
  clearPrefetch,
  prefetchSongUrl,
  takePrefetchTargetIndex,
  takePrefetchedUrl,
} from '../lib/prefetch';
import { useToast } from './toast';

export type PlayerMode = 'repeat' | 'single' | 'shuffle' | 'order';

export const MODE_META: Record<PlayerMode, { label: string; icon: string }> = {
  repeat: { label: '列表循环', icon: 'repeat' },
  single: { label: '单曲循环', icon: 'single' },
  shuffle: { label: '随机播放', icon: 'shuffle' },
  order: { label: '顺序播放', icon: 'order' },
};

let audioEl: HTMLAudioElement | null = null;

/** 动画直接读取音频时钟；不提高全局 store 的更新频率。 */
export function getPlaybackTime(): number {
  return audioEl?.src && audioEl.readyState >= 1 ? audioEl.currentTime : usePlayer.getState().time;
}

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

/* ------------------------------- 后台切歌辅助 ------------------------------- */

/**
 * 播放意图：true = 期望继续播放（用户点了播放 / 自动切歌）。
 * 后台被系统打断后（进程冻结、play() 被系统拒绝等），回到前台时用它自动续播。
 */
let wantPlaying = false;
/** 失败自动重试预算：成功播放时清零，避免无限重试 */
let playRetryBudget = 0;
/** 音频 error 事件次数：先原地重试一次，再跳下一首 */
let mediaErrorAttempts = 0;
/** 已为哪首歌预取过下一首地址 */
let prefetchedForHash = '';

const sleep = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

/** 播放：后台偶发的 play() 失败（AbortError 等）重试几次 */
async function tryPlay(audio: HTMLAudioElement): Promise<boolean> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await audio.play();
      if (!audio.paused) return true;
    } catch {
      /* 继续重试 */
    }
    if (attempt < 2) await sleep(250);
  }
  return !audio.paused;
}

/** 预取目标：随机模式随机选一首并记下来，保证「切歌」与「预取」是同一首 */
function pickPrefetchIndex(): number | null {
  const { queue, index, mode } = usePlayer.getState();
  if (!queue.length || mode === 'single') return null;
  if (mode === 'shuffle') {
    return queue.length === 1 ? 0 : Math.floor(Math.random() * queue.length);
  }
  return (index + 1) % queue.length;
}

/** 快播完时预取下一首播放地址，切歌时不再等网络 */
function prefetchNextUp() {
  const { queue, quality } = usePlayer.getState();
  const nextIndex = pickPrefetchIndex();
  if (nextIndex === null) return;
  prefetchSongUrl(queue[nextIndex], quality, nextIndex);
}

/** 解析地址失败时重试同一首（后台网络短暂不可用 / 酷狗风控抖动） */
function scheduleLoadRetry(song: Song) {
  if (playRetryBudget >= 3) {
    releaseBackgroundAudioSoon(3000);
    return;
  }
  playRetryBudget += 1;
  const delay = 1500 * playRetryBudget;
  window.setTimeout(() => {
    const state = usePlayer.getState();
    if (!wantPlaying || state.playing || state.loading) return;
    if (state.queue[state.index]?.hash !== song.hash) return;
    void state.loadCurrent();
  }, delay);
}

/** play() 失败时重试播放当前已加载的地址 */
function schedulePlayRetry(song: Song) {
  if (playRetryBudget >= 3) return;
  playRetryBudget += 1;
  window.setTimeout(() => {
    const audio = getAudio();
    const state = usePlayer.getState();
    if (!audio || !wantPlaying || state.playing || state.loading) return;
    if (state.queue[state.index]?.hash !== song.hash) return;
    void tryPlay(audio).then((ok) => {
      usePlayer.setState({ playing: !audio.paused, buffering: false });
      if (!ok) schedulePlayRetry(song);
    });
  }, 800 * playRetryBudget);
}

/**
 * 看门狗：播放意图还在、音频却处于暂停状态（后台 play() 被拒 / 被系统打断 / 卡死），
 * 每隔一段时间兜底重试一次，避免「无声地停住不动」后只能手动点播放。
 */
let watchdogAttempts = 0;
let watchdogHash = '';
let watchdogLastAction = 0;

function startPlaybackWatchdog() {
  if (typeof window === 'undefined') return;
  window.setInterval(() => {
    const audio = getAudio();
    if (!audio) return;
    const state = usePlayer.getState();
    const song = state.queue[state.index];
    if (!wantPlaying || !song || state.loading || state.buffering) return;
    if (!audio.paused) return;
    // 已经自然播完 / 正在由 ended、error 流程处理，交给各自的重试逻辑
    if (audio.ended || !audio.src) return;

    const now = Date.now();
    if (now - watchdogLastAction < 8000) return;
    watchdogLastAction = now;
    if (song.hash !== watchdogHash) {
      watchdogHash = song.hash;
      watchdogAttempts = 0;
    }
    if (watchdogAttempts >= 5) return;
    watchdogAttempts += 1;
    void tryPlay(audio).then((ok) => {
      if (ok) return;
      usePlayer.setState({ playing: false });
      schedulePlayRetry(song);
    });
  }, 3000);
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
    clearPrefetch();
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

    // 整个切歌过程（pause → ended → 解析/预取 → play）都要保住前台服务：
    // 空档里服务被回收，进程可能被系统冻结，下一首就再也起不来了
    wantPlaying = true;
    acquireBackgroundAudio();

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
      // 优先用预取好的地址：切歌时几乎不需要等网络
      const prefetched = takePrefetchedUrl(song, state.quality);
      const resolved = prefetched ?? (await resolveSongUrl(song, state.quality));

      // 解析地址期间用户可能已经切到别的歌，丢弃过期结果
      if (get().queue[get().index]?.hash !== song.hash) return;

      audio.src = resolved.url;
      audio.load();
      const started = await tryPlay(audio);
      set({
        loading: false,
        buffering: false,
        playing: !audio.paused,
        resolvedQuality: resolved.quality,
        error: null,
      });
      updateMediaSession(song);
      persistLast(get());
      if (!started && wantPlaying) schedulePlayRetry(song);
    } catch (err) {
      const isAuth = err instanceof AuthRequiredError;
      const message = err instanceof Error ? err.message : '播放失败';
      set({ loading: false, buffering: false, playing: false, error: message });
      useToast
        .getState()
        .show(isAuth ? '这首歌需要登录后才能播放' : message, isAuth ? 'warn' : 'error');
      // 后台切歌时网络可能只是短暂失败：自动重试同一首；登录类错误不重试
      if (!isAuth && wantPlaying) scheduleLoadRetry(song);
      else releaseBackgroundAudioSoon(3000);
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
      wantPlaying = true;
      acquireBackgroundAudio();
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
      const started = await tryPlay(audio);
      if (!started) set({ playing: false });
    } else {
      wantPlaying = false;
      audio.pause();
      releaseBackgroundAudioNow();
    }
  },

  next: async (auto = false) => {
    const { queue, index, mode, quality } = get();
    if (!queue.length) return;
    let nextIndex = index + 1;
    if (mode === 'shuffle') {
      // 预取时已经选好了「下一首」，自动切歌时沿用，保证播放的就是预取的那首
      const prefetched = auto ? takePrefetchTargetIndex(queue, quality) : null;
      nextIndex = prefetched ?? (queue.length === 1 ? 0 : Math.floor(Math.random() * queue.length));
    }
    if (nextIndex >= queue.length) {
      if (mode === 'order' && auto) {
        wantPlaying = false;
        getAudio()?.pause();
        set({ playing: false });
        releaseBackgroundAudioNow();
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
    clearPrefetch();
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
      wantPlaying = false;
      set({ queue: [], index: 0, playing: false });
      getAudio()?.pause();
      releaseBackgroundAudioNow();
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
    wantPlaying = false;
    getAudio()?.pause();
    getAudio()?.removeAttribute('src');
    clearPrefetch();
    set({ queue: [], index: 0, playing: false, time: 0, duration: 0, lyric: null, error: null });
    releaseBackgroundAudioNow();
  },

  setQueueOpen: (queueOpen) => set({ queueOpen }),

  onEnded: () => {
    const { mode } = get();
    if (mode === 'single') {
      const audio = getAudio();
      if (audio) {
        wantPlaying = true;
        acquireBackgroundAudio();
        audio.currentTime = 0;
        void tryPlay(audio);
      }
      return;
    }
    void get().next(true);
  },

  stop: () => {
    wantPlaying = false;
    getAudio()?.pause();
    set({ playing: false });
    releaseBackgroundAudioNow();
  },
}));

/**
 * App 回到前台时调用：如果本该继续播放却被系统在后台打断（切歌失败 / 进程被冻结），自动续上。
 */
export async function resumePlaybackIfNeeded(): Promise<void> {
  const state = usePlayer.getState();
  const audio = getAudio();
  if (!audio || !state.queue.length || !wantPlaying || state.loading) return;

  playRetryBudget = 0;
  acquireBackgroundAudio();

  const endedOrAtTail =
    audio.ended ||
    (Number.isFinite(audio.duration) && audio.duration > 0 && audio.currentTime >= audio.duration - 0.5);
  if (endedOrAtTail || !audio.src) {
    // 上一首已经放完但没接上（或地址根本没加载成功）：重新加载当前曲目
    await state.loadCurrent();
    return;
  }
  if (audio.paused) {
    const started = await tryPlay(audio);
    usePlayer.setState({ playing: !audio.paused, buffering: false, error: started ? null : state.error });
  }
}

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

    // 快播完时提前解析下一首地址：切歌不再等网络，后台空档更短
    const duration = audio.duration;
    const state = usePlayer.getState();
    const hash = state.queue[state.index]?.hash ?? '';
    if (
      hash &&
      hash !== prefetchedForHash &&
      Number.isFinite(duration) &&
      duration > 30 &&
      duration - audio.currentTime <= 25
    ) {
      prefetchedForHash = hash;
      prefetchNextUp();
    }
  });

  audio.addEventListener('durationchange', () => {
    usePlayer.setState({ duration: Number.isFinite(audio.duration) ? audio.duration : 0 });
  });

  audio.addEventListener('playing', () => {
    usePlayer.setState({ playing: true, loading: false, buffering: false, error: null });
    mediaErrorAttempts = 0;
    playRetryBudget = 0;
    prefetchedForHash = '';
    watchdogAttempts = 0;
    watchdogHash = '';
    acquireBackgroundAudio();
  });

  audio.addEventListener('pause', () => {
    usePlayer.setState({ playing: false });
    if (audio.ended) {
      // 一首歌自然播完：切歌空档里先别停前台服务，否则进程可能被冻结、
      // 且 Android 12+ 在后台无法重新启动前台服务，下一首会直接失效
      releaseBackgroundAudioSoon();
    } else if (usePlayer.getState().loading) {
      // 正在切歌（loadCurrent 换 src 的瞬间）：同样保持前台服务
    } else {
      // 用户暂停 / 手动切歌：立即释放
      releaseBackgroundAudioNow();
    }
  });

  audio.addEventListener('waiting', () => {
    usePlayer.setState({ buffering: true });
  });

  audio.addEventListener('canplay', () => {
    usePlayer.setState({ buffering: false });
  });

  audio.addEventListener('ended', () => usePlayer.getState().onEnded());

  audio.addEventListener('error', () => {
    if (!audio.src) return;
    const state = usePlayer.getState();
    usePlayer.setState({ playing: false, buffering: false, loading: false });
    if (!state.queue.length || !wantPlaying) return;

    // 预取地址可能过期 / 网络抖动：先原地重新解析一次，还不行再跳下一首
    if (mediaErrorAttempts < 1) {
      mediaErrorAttempts += 1;
      window.setTimeout(() => {
        const current = usePlayer.getState();
        if (!wantPlaying || current.playing || current.loading) return;
        void current.loadCurrent();
      }, 600);
      return;
    }
    useToast.getState().show('音频加载失败，正在尝试下一首', 'warn');
    window.setTimeout(() => void usePlayer.getState().next(true), 900);
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

  startPlaybackWatchdog();
})();
