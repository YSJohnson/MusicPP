import { useEffect, useState } from 'react';

export interface RequestState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

interface CacheEntry {
  data: unknown;
  at: number;
}

/** 跨页面缓存：回到首页 / 切换 Tab 时不再重新请求 */
const cache = new Map<string, CacheEntry>();
const DEFAULT_TTL = 5 * 60_000;

export function clearRequestCache() {
  cache.clear();
}

/** 轻量数据请求 hook：自动处理 loading / error / 重试，带短期缓存 */
export function useRequest<T>(
  fetcher: () => Promise<T>,
  deps: unknown[],
  options?: { enabled?: boolean; cacheKey?: string; cacheTime?: number },
): RequestState<T> {
  const enabled = options?.enabled !== false;
  const ttl = options?.cacheTime ?? DEFAULT_TTL;
  const key = options?.cacheKey ?? `${JSON.stringify(deps)}::${fetcher.toString()}`;
  const [data, setData] = useState<T | null>(() => (cache.get(key)?.data as T) ?? null);
  const [loading, setLoading] = useState(enabled && !cache.has(key));
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    const hit = cache.get(key);
    if (hit) {
      setData(hit.data as T);
      setError(null);
    }

    // 命中且未过期：直接复用，不再请求
    if (hit && nonce === 0 && Date.now() - hit.at < ttl) {
      setLoading(false);
      return;
    }

    let alive = true;
    // 有旧数据时静默刷新，避免闪一下骨架屏
    setLoading(!hit);
    setError(null);
    fetcher()
      .then((result) => {
        cache.set(key, { data: result, at: Date.now() });
        if (alive) {
          setData(result);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (alive) {
          setError(err instanceof Error ? err.message : '加载失败');
          setLoading(false);
        }
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce, enabled, key]);

  return { data, loading, error, reload: () => setNonce((n) => n + 1) };
}
