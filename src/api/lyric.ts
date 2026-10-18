import type { Lyric, LyricLine, LyricWord } from './types';

const KRC_LINE = /^\[(\d+),(\d+)\](.*)$/;
const KRC_WORD = /<(\d+),(\d+),\d+>([^<]*)/g;
const LRC_LINE = /^\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\](.*)$/;

/** 歌词里常见的制作信息行，展示时过滤掉更干净 */
const CREDIT_LINE =
  /(作词|作曲|编曲|制作|监制|混音|母带|录音|配唱|和声|合声|吉他|贝斯|Bass|鼓|键盘|弦乐|小号|小提琴|大提琴|长笛|萨克斯|钢琴|统筹|企划|出品|发行|人声编辑|音乐制作|原唱|翻唱|谱曲|填词|宣发|营销|设计|封面|摄影|出品人|编曲人|制作人)[\u4e00-\u9fa5A-Za-z0-9／/、·．.\s]{0,12}[：:]/;

/** 解析 KRC（逐字）或 LRC 歌词 */
export function parseLyric(raw?: string | null): Lyric | null {
  if (!raw || typeof raw !== 'string') return null;
  const lines: LyricLine[] = [];
  let krc = false;

  for (const rawLine of raw.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const km = line.match(KRC_LINE);
    if (km) {
      krc = true;
      const start = Number(km[1]);
      const dur = Number(km[2]);
      const body = km[3];
      const words: LyricWord[] = [];
      let wm: RegExpExecArray | null;
      KRC_WORD.lastIndex = 0;
      while ((wm = KRC_WORD.exec(body))) {
        const offset = Number(wm[1]);
        const wdur = Number(wm[2]);
        const text = wm[3];
        if (!text) continue;
        words.push({ time: start + offset, dur: wdur, text });
      }
      const text = words.map((w) => w.text).join('') || body.replace(/<\d+,\d+,\d+>/g, '');
      if (!text.trim() && !words.length) continue;
      if (CREDIT_LINE.test(text.trim())) continue;
      lines.push({ time: start, dur, text, words: words.length ? words : undefined });
      continue;
    }
    const lm = line.match(LRC_LINE);
    if (lm) {
      const start =
        Number(lm[1]) * 60_000 + Number(lm[2]) * 1000 + Number((lm[3] ?? '0').padEnd(3, '0'));
      const text = lm[4].trim();
      if (!text) continue;
      if (CREDIT_LINE.test(text)) continue;
      lines.push({ time: start, dur: 0, text });
    }
  }

  if (!lines.length) return null;
  lines.sort((a, b) => a.time - b.time);
  return { lines, krc };
}
