import { resolveSongUrl } from '../api';
import type { Song } from '../api/types';

/**
 * 播放地址预取
 *
 * 解析一首歌的播放地址需要一次网络请求。原先的实现是在「上一首 ended」之后才开始请求，
 * 后台播放时这段空档正好是系统回收/冻结进程的高危窗口。
 * 这里在歌曲快播完时提前把下一首的地址取好，切歌时直接复用，几乎零空档。
 */

interface Prefetched {
  url: string;
  quality: string;
  at: number;
}

/** 预取结果的有效期：地址本身长期有效，这里只是防止用到太旧的缓存 */
const TTL = 3 * 60_000;
const MAX_CACHE = 8;

const cache = new Map<string, Prefetched>();
const inflight = new Set<string>();

/** 预取时记下的「下一首」目标，随机模式下用它保证切歌和预取是同一首 */
let target: { index: number; hash: string; quality: string } | null = null;

function keyOf(song: Song, quality: string): string {
  return `${song.hash}|${quality}`;
}

/** 取出预取好的播放地址（命中即用；取走即删除） */
export function takePrefetchedUrl(song: Song, quality: string): { url: string; quality: string } | null {
  const key = keyOf(song, quality);
  const hit = cache.get(key);
  if (!hit) return null;
  cache.delete(key);
  if (Date.now() - hit.at > TTL) return null;
  return { url: hit.url, quality: hit.quality };
}

/** 预取某首歌的播放地址（失败静默，真正播放时会重新请求） */
export function prefetchSongUrl(song: Song | undefined, quality: string, index?: number) {
  if (!song) return;
  const key = keyOf(song, quality);
  if (cache.has(key) || inflight.has(key)) return;
  if (cache.size >= MAX_CACHE) cache.clear();
  inflight.add(key);
  void resolveSongUrl(song, quality)
    .then((res) => {
      cache.set(key, { url: res.url, quality: res.quality, at: Date.now() });
    })
    .catch(() => {
      /* 忽略：真正播放时会再请求一次 */
    })
    .finally(() => inflight.delete(key));
  if (index !== undefined) target = { index, hash: song.hash, quality };
}

/** 随机模式下取预取时选中的下一首索引（仍有效才返回） */
export function takePrefetchTargetIndex(queue: Song[], quality: string): number | null {
  if (!target || target.quality !== quality) return null;
  const idx = target.index;
  const song = queue[idx];
  if (!song || song.hash !== target.hash) return null;
  target = null;
  return idx;
}

/** 清空预取缓存（换队列 / 换音质时调用） */
export function clearPrefetch() {
  cache.clear();
  target = null;
}
