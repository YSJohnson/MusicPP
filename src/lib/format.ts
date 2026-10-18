/** 时长、数量、日期等格式化工具 */

export const pad2 = (n: number) => String(n).padStart(2, '0');

/** 秒 -> mm:ss */
export function fmtTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${pad2(s)}`;
}

/** 毫秒或秒自适应 -> mm:ss */
export function fmtDuration(value: number | undefined | null): string {
  if (!value || !Number.isFinite(value)) return '--:--';
  const sec = value > 10000 ? value / 1000 : value;
  return fmtTime(sec);
}

/** 播放量 -> 1.2万 / 3.4亿 */
export function fmtCount(n: number | undefined | null): string {
  if (!n || !Number.isFinite(n)) return '0';
  if (n >= 1e8) return `${(n / 1e8).toFixed(1).replace(/\.0$/, '')}亿`;
  if (n >= 1e4) return `${(n / 1e4).toFixed(1).replace(/\.0$/, '')}万`;
  return String(n);
}

/** 封面地址补全尺寸占位符，并统一协议 */
export function coverUrl(url?: string | null, size = 480): string | undefined {
  if (!url) return undefined;
  let u = url.replace('{size}', String(size)).replace(/^http:\/\//i, 'http://');
  if (u.startsWith('//')) u = 'http:' + u;
  return u;
}

export function fmtDate(d = new Date()): string {
  const week = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'][d.getDay()];
  return `${d.getMonth() + 1}月${d.getDate()}日 · ${week}`;
}

export function greeting(d = new Date()): string {
  const h = d.getHours();
  if (h < 5) return '夜深了';
  if (h < 9) return '早上好';
  if (h < 12) return '上午好';
  if (h < 14) return '中午好';
  if (h < 18) return '下午好';
  if (h < 23) return '晚上好';
  return '夜深了';
}

/** 从 "歌手 - 歌名" 之类的文件名里拆分 */
export function splitFilename(filename?: string): { artist?: string; name?: string } {
  if (!filename) return {};
  const idx = filename.indexOf(' - ');
  if (idx > 0) return { artist: filename.slice(0, idx), name: filename.slice(idx + 3) };
  return { name: filename };
}

export function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

export function randomId(len = 12): string {
  const chars = 'abcdef0123456789';
  let s = '';
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}
