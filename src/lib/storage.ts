/** 轻量本地存储封装，Web / Capacitor 通用 */
export function readStore<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeStore(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore quota errors */
  }
}

export function removeStore(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}
