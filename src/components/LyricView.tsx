import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { Lyric } from '../api/types';
import { fmtTime } from '../lib/format';
import { cn } from '../lib/cn';
import { Icon } from './Icon';

interface LyricViewProps {
  lyric: Lyric | null;
  loading: boolean;
  time: number;
  /** 歌词对齐方式 */
  align?: 'center' | 'left';
  /** 上下拖动歌词选择进度，点指示条上的按钮才真正跳转 */
  onSeek?: (time: number) => void;
}

export function LyricView({ lyric, loading, time, align = 'center', onSeek }: LyricViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<Array<HTMLDivElement | null>>([]);

  const [pending, setPending] = useState(false);
  const [seekIndex, setSeekIndex] = useState(-1);
  const dragRef = useRef<{ startY: number; startScroll: number; moved: boolean } | null>(null);
  const timerRef = useRef<number | null>(null);
  const ignoreClickRef = useRef(false);

  const activeIndex = useMemo(() => {
    if (!lyric?.lines.length) return -1;
    const ms = time * 1000 + 120;
    let idx = -1;
    for (let i = 0; i < lyric.lines.length; i++) {
      if (lyric.lines[i].time <= ms) idx = i;
      else break;
    }
    return idx;
  }, [lyric, time]);

  const clearTimer = () => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const cancelSeek = () => {
    clearTimer();
    setPending(false);
    setSeekIndex(-1);
  };

  // 播放进度变化时自动把当前行滚到中间（选择进度期间/等待跳转期间不抢滚动）
  useEffect(() => {
    if (pending) return;
    const box = scrollRef.current;
    const el = lineRefs.current[activeIndex >= 0 ? activeIndex : 0];
    if (!box || !el) return;
    const target = el.offsetTop - box.clientHeight / 2 + el.clientHeight / 2;
    box.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, pending]);

  useEffect(() => () => clearTimer(), []);

  const nearestLine = () => {
    const box = scrollRef.current;
    if (!box) return -1;
    const center = box.scrollTop + box.clientHeight / 2;
    let best = -1;
    let bestDist = Infinity;
    lineRefs.current.forEach((el, i) => {
      if (!el) return;
      const c = el.offsetTop + el.offsetHeight / 2;
      const d = Math.abs(c - center);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    });
    return best;
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!onSeek || !lyric?.lines.length) return;
    const box = scrollRef.current;
    if (!box) return;
    dragRef.current = { startY: e.clientY, startScroll: box.scrollTop, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const box = scrollRef.current;
    if (!drag || !box) return;
    const dy = e.clientY - drag.startY;
    if (!drag.moved && Math.abs(dy) < 8) return;
    drag.moved = true;
    clearTimer();
    if (!pending) setPending(true);
    box.scrollTop = drag.startScroll - dy;
    const idx = nearestLine();
    if (idx >= 0) setSeekIndex(idx);
  };

  const finishDrag = () => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag) return;
    if (drag.moved) {
      // 拖动结束后不立即跳转：2 秒内没有点播放按钮就回到当前播放位置
      ignoreClickRef.current = true;
      window.setTimeout(() => {
        ignoreClickRef.current = false;
      }, 400);
      clearTimer();
      timerRef.current = window.setTimeout(() => {
        setPending(false);
        setSeekIndex(-1);
      }, 2000);
    }
  };

  const commitSeek = () => {
    if (!lyric || seekIndex < 0) return;
    const target = lyric.lines[seekIndex]?.time;
    clearTimer();
    if (typeof target === 'number') onSeek?.(target / 1000);
    setPending(false);
    setSeekIndex(-1);
  };

  if (loading) {
    return (
      <div className="lyric-empty">
        <Icon name="disc" size={22} className="spin" />
        正在加载歌词
      </div>
    );
  }

  if (!lyric?.lines.length) {
    return (
      <div className="lyric-empty">
        <Icon name="music" size={24} />
        <span>
          暂无歌词
          <br />轻点这里可以返回封面
        </span>
      </div>
    );
  }

  const highlightIndex = pending && seekIndex >= 0 ? seekIndex : activeIndex;
  const seekLine = pending && seekIndex >= 0 ? lyric.lines[seekIndex] : null;

  const box = scrollRef.current;
  const lineEl = seekIndex >= 0 ? lineRefs.current[seekIndex] : null;
  const seekTop =
    pending && box && lineEl ? lineEl.offsetTop + lineEl.offsetHeight / 2 - box.scrollTop : 0;

  return (
    <div
      className={cn('lyric-view', align === 'left' && 'align-left', pending && 'seeking')}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finishDrag}
      onPointerCancel={() => {
        dragRef.current = null;
        if (!pending) setSeekIndex(-1);
      }}
      onClick={(e) => {
        if (ignoreClickRef.current) {
          ignoreClickRef.current = false;
          e.stopPropagation();
          return;
        }
        if (pending) {
          cancelSeek();
          e.stopPropagation();
        }
      }}
    >
      <div className="lyric-scroll" ref={scrollRef}>
        {lyric.lines.map((line, i) => {
          const active = i === highlightIndex;
          return (
            <div
              key={`${line.time}-${i}`}
              ref={(el) => {
                lineRefs.current[i] = el;
              }}
              className={cn(
                'lyric-line',
                active && 'active',
                pending && i === seekIndex && 'seek-target',
              )}
            >
              {line.words && active
                ? line.words.map((w, wi) => {
                    const progress = Math.max(
                      0,
                      Math.min(100, ((time * 1000 - w.time) / Math.max(1, w.dur)) * 100),
                    );
                    return (
                      <span
                        key={wi}
                        className="w"
                        style={{ '--p': progress.toFixed(1) } as CSSProperties}
                      >
                        {w.text}
                      </span>
                    );
                  })
                : line.text}
            </div>
          );
        })}
      </div>

      {pending && seekLine && (
        <>
          <div className="lyric-seekline" style={{ top: seekTop }} />
          <div className="lyric-seekbar" style={{ top: seekTop }}>
            <span className="s-time">{fmtTime(seekLine.time / 1000)}</span>
            <button
              type="button"
              className="s-play"
              aria-label="跳转到选中歌词"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                commitSeek();
              }}
            >
              <Icon name="play" size={12} filled />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
