import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Lyric, LyricLine } from '../api/types';
import { usePlaybackFrame } from '../hooks/usePlaybackFrame';
import { getPlaybackTime } from '../store/player';
import { fmtTime } from '../lib/format';
import { cn } from '../lib/cn';
import { Icon } from './Icon';

interface LyricViewProps {
  lyric: Lyric | null;
  loading: boolean;
  align?: 'center' | 'left';
  /** 上下拖动歌词选择进度，点指示条上的按钮才真正跳转 */
  onSeek?: (time: number) => void;
}

function indexAt(lines: LyricLine[], ms: number) {
  let lo = 0;
  let hi = lines.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (lines[mid].time <= ms) lo = mid + 1;
    else hi = mid;
  }
  return lo - 1;
}

const LyricRow = memo(function LyricRow({ line, index, active, selected, register }: {
  line: LyricLine;
  index: number;
  active: boolean;
  selected: boolean;
  register: (index: number, el: HTMLDivElement | null) => void;
}) {
  const rowRef = useCallback((el: HTMLDivElement | null) => register(index, el), [index, register]);
  return (
    <div
      ref={rowRef}
      className={cn('lyric-line', active && 'active', selected && 'seek-target')}
    >
      {line.words?.length
        ? line.words.map((word, i) => <span key={i} className="w">{word.text}</span>)
        : line.text}
    </div>
  );
});

export const LyricView = memo(function LyricView({ lyric, loading, align = 'center', onSeek }: LyricViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<Array<HTMLDivElement | null>>([]);
  const centersRef = useRef<number[]>([]);
  const viewportHeightRef = useRef(0);
  const seekLineRef = useRef<HTMLDivElement>(null);
  const seekBarRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(() => indexAt(lyric?.lines ?? [], getPlaybackTime() * 1000));
  const activeRef = useRef(activeIndex);
  const wordCacheRef = useRef<{ index: number; spans: HTMLElement[]; progress: string[] }>({
    index: -1, spans: [], progress: [],
  });
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);
  const [seekIndex, setSeekIndex] = useState(-1);
  const seekIndexRef = useRef(-1);
  const dragRef = useRef<{
    pointerId: number; startY: number; y: number; startScroll: number; moved: boolean;
    lastTime: number; velocity: number;
  } | null>(null);
  const dragFrameRef = useRef(0);
  const inertiaFrameRef = useRef(0);
  const returnFrameRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const ignoreClickRef = useRef(false);

  const registerLine = useCallback((index: number, el: HTMLDivElement | null) => {
    lineRefs.current[index] = el;
  }, []);

  usePlaybackFrame((time) => {
    const lines = lyric?.lines ?? [];
    const ms = time * 1000;
    const index = indexAt(lines, ms);
    if (index !== activeRef.current) {
      activeRef.current = index;
      setActiveIndex(index);
    }
    followPlayback(time);
    const words = lines[index]?.words;
    if (!words?.length) return;
    let cache = wordCacheRef.current;
    if (cache.index !== index) {
      cache = { index, spans: Array.from(lineRefs.current[index]?.querySelectorAll<HTMLElement>('.w') ?? []), progress: [] };
      wordCacheRef.current = cache;
    }
    // 只改当前行发生变化的字，整页歌词不参与逐帧 React 渲染。
    words.forEach((word, i) => {
      const progress = Math.max(0, Math.min(100, (ms - word.time) / Math.max(1, word.dur) * 100)).toFixed(2);
      if (cache.progress[i] === progress) return;
      cache.spans[i]?.style.setProperty('--p', progress);
      cache.progress[i] = progress;
    });
  }, !loading && !!lyric?.lines.length);

  const clearTimer = () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
  };
  const cancelSeek = () => {
    clearTimer();
    cancelAnimationFrame(inertiaFrameRef.current);
    inertiaFrameRef.current = 0;
    pendingRef.current = false;
    seekIndexRef.current = -1;
    setPending(false);
    setSeekIndex(-1);
    returnToPlayback();
  };
  const scheduleReturn = () => {
    clearTimer();
    timerRef.current = window.setTimeout(cancelSeek, 2000);
  };

  const scrollPositionAt = (time: number) => {
    const lines = lyric?.lines ?? [];
    const centers = centersRef.current;
    if (!centers.length) return 0;
    const index = Math.max(0, Math.min(centers.length - 1, indexAt(lines, time * 1000)));
    const next = index + 1;
    const interval = next < lines.length ? lines[next].time - lines[index].time : 0;
    const progress = interval > 0 ? Math.min(1, Math.max(0, (time * 1000 - lines[index].time) / interval)) : 0;
    const center = centers[index] + ((centers[next] ?? centers[index]) - centers[index]) * progress;
    return Math.max(0, center - viewportHeightRef.current / 2);
  };

  const followPlayback = (time: number) => {
    const box = scrollRef.current;
    if (!box || pendingRef.current || dragRef.current || returnFrameRef.current) return;
    // 在相邻歌词时间之间连续插值，整句播放期间也一直平滑上移。
    paintPlaybackPosition(scrollPositionAt(time));
  };

  const paintPlaybackPosition = (position: number) => {
    const box = scrollRef.current;
    if (!box) return;
    box.scrollTop = position;
    // scrollTop 会按设备像素取整，剩余小数用合成层位移补足。
    if (contentRef.current) contentRef.current.style.transform = `translate3d(0, ${box.scrollTop - position}px, 0)`;
  };

  const returnToPlayback = () => {
    cancelAnimationFrame(returnFrameRef.current);
    returnFrameRef.current = 0;
    const box = scrollRef.current;
    if (!box) return;
    const from = box.scrollTop;
    const started = performance.now();
    if (Math.abs(from - scrollPositionAt(getPlaybackTime())) < 1) {
      followPlayback(getPlaybackTime());
      return;
    }
    const tick = (now: number) => {
      const progress = Math.min(1, (now - started) / 320);
      paintPlaybackPosition(from + (scrollPositionAt(getPlaybackTime()) - from) * (1 - (1 - progress) ** 3));
      returnFrameRef.current = progress < 1 ? requestAnimationFrame(tick) : 0;
    };
    returnFrameRef.current = requestAnimationFrame(tick);
  };

  const updateSelection = () => {
    const box = scrollRef.current;
    const centers = centersRef.current;
    if (!box || !centers.length) return;
    const middle = box.scrollTop + viewportHeightRef.current / 2;
    // 行中心只在布局变化时测量；手势中二分查找，不遍历和测量 DOM。
    let lo = 0;
    let hi = centers.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (centers[mid] < middle) lo = mid + 1;
      else hi = mid;
    }
    const index = lo > 0 && middle - centers[lo - 1] < centers[lo] - middle ? lo - 1 : lo;
    if (index !== seekIndexRef.current) {
      seekIndexRef.current = index;
      setSeekIndex(index);
    }
    // 指示线固定在视口中间，歌词自由经过，选中最近一行，不吸附行中心。
    const transform = `translate3d(0, ${viewportHeightRef.current / 2}px, 0) translateY(-50%)`;
    if (seekLineRef.current) seekLineRef.current.style.transform = transform;
    if (seekBarRef.current) seekBarRef.current.style.transform = transform;
  };

  useLayoutEffect(() => {
    const box = scrollRef.current;
    const content = contentRef.current;
    if (!box || !content || !lyric?.lines.length) return;
    wordCacheRef.current = { index: -1, spans: [], progress: [] };
    lineRefs.current.length = lyric.lines.length;
    const measure = () => {
      viewportHeightRef.current = box.clientHeight;
      const rows = lineRefs.current;
      const firstHeight = rows[0]?.offsetHeight ?? 0;
      const lastHeight = rows[rows.length - 1]?.offsetHeight ?? 0;
      box.style.setProperty('--lyric-padding-top', `${Math.max(0, (box.clientHeight - firstHeight) / 2)}px`);
      box.style.setProperty('--lyric-padding-bottom', `${Math.max(0, (box.clientHeight - lastHeight) / 2)}px`);
      const origin = content.offsetTop;
      centersRef.current = rows.map((el) => el ? origin + el.offsetTop + el.offsetHeight / 2 : 0);
      if (pendingRef.current) updateSelection();
      else followPlayback(getPlaybackTime());
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    observer.observe(content);
    return () => observer.disconnect();
  }, [lyric, loading, align]);

  useEffect(() => () => {
    clearTimer();
    cancelAnimationFrame(dragFrameRef.current);
    cancelAnimationFrame(inertiaFrameRef.current);
    cancelAnimationFrame(returnFrameRef.current);
  }, []);

  const paintDrag = () => {
    dragFrameRef.current = 0;
    const drag = dragRef.current;
    const box = scrollRef.current;
    if (!drag?.moved || !box) return;
    box.scrollTop = drag.startScroll - (drag.y - drag.startY);
    updateSelection();
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!e.isPrimary || e.button !== 0 || !onSeek || !lyric?.lines.length) return;
    const box = scrollRef.current;
    if (!box) return;
    clearTimer();
    cancelAnimationFrame(inertiaFrameRef.current);
    cancelAnimationFrame(returnFrameRef.current);
    inertiaFrameRef.current = 0;
    returnFrameRef.current = 0;
    ignoreClickRef.current = false;
    if (contentRef.current) contentRef.current.style.transform = '';
    // 中断正在进行的自动平滑滚动，避免它与手指争抢 scrollTop。
    box.scrollTo({ top: box.scrollTop, behavior: 'instant' });
    dragRef.current = { pointerId: e.pointerId, startY: e.clientY, y: e.clientY, startScroll: box.scrollTop,
      moved: false, lastTime: e.timeStamp, velocity: 0 };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const elapsed = e.timeStamp - drag.lastTime;
    if (elapsed > 0) drag.velocity = Math.max(-3, Math.min(3, (drag.y - e.clientY) / elapsed));
    drag.lastTime = e.timeStamp;
    drag.y = e.clientY;
    if (!drag.moved && Math.abs(drag.y - drag.startY) < 8) return;
    drag.moved = true;
    if (!pendingRef.current) {
      pendingRef.current = true;
      setPending(true);
    }
    if (!dragFrameRef.current) dragFrameRef.current = requestAnimationFrame(paintDrag);
  };

  const startInertia = (velocity: number) => {
    const box = scrollRef.current;
    if (!box || Math.abs(velocity) < 0.05) { scheduleReturn(); return; }
    let last = performance.now();
    const tick = (now: number) => {
      const elapsed = Math.min(32, now - last);
      last = now;
      const before = box.scrollTop;
      box.scrollTop += velocity * elapsed;
      velocity *= Math.exp(-elapsed / 180);
      updateSelection();
      if (Math.abs(velocity) < 0.025 || Math.abs(box.scrollTop - before) < 0.1) {
        inertiaFrameRef.current = 0;
        scheduleReturn();
      } else inertiaFrameRef.current = requestAnimationFrame(tick);
    };
    inertiaFrameRef.current = requestAnimationFrame(tick);
  };

  const finishDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    if (e.type === 'pointerup') drag.y = e.clientY;
    cancelAnimationFrame(dragFrameRef.current);
    // 应用最后一个尚未绘制的手势位置，再结束捕获。
    paintDrag();
    dragRef.current = null;
    if (drag.moved) ignoreClickRef.current = true;
    if (pendingRef.current) {
      const velocity = e.type === 'pointerup' && e.timeStamp - drag.lastTime < 80 ? drag.velocity : 0;
      startInertia(velocity);
    } else returnToPlayback();
  };

  const commitSeek = () => {
    const target = lyric?.lines[seekIndexRef.current]?.time;
    if (target !== undefined) onSeek?.(target / 1000);
    cancelSeek();
  };

  if (loading) {
    return <div className="lyric-empty"><Icon name="disc" size={22} className="spin" />正在加载歌词</div>;
  }
  if (!lyric?.lines.length) {
    return (
      <div className="lyric-empty">
        <Icon name="music" size={24} />
        <span>暂无歌词<br />轻点这里可以返回封面</span>
      </div>
    );
  }
  const seekLine = lyric.lines[seekIndex];
  return (
    <div
      className={cn('lyric-view', align === 'left' && 'align-left', pending && 'seeking')}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
      onLostPointerCapture={finishDrag}
      onClick={(e) => {
        if (ignoreClickRef.current) {
          ignoreClickRef.current = false;
          e.stopPropagation();
        } else if (pendingRef.current) {
          cancelSeek();
          e.stopPropagation();
        }
      }}
    >
      <div className="lyric-scroll" ref={scrollRef}
        onWheel={() => {
          if (!onSeek) return;
          cancelAnimationFrame(returnFrameRef.current);
          cancelAnimationFrame(inertiaFrameRef.current);
          returnFrameRef.current = 0;
          inertiaFrameRef.current = 0;
          if (contentRef.current) contentRef.current.style.transform = '';
          pendingRef.current = true;
          setPending(true);
          updateSelection();
          scheduleReturn();
        }}
        onScroll={() => {
          if (!pendingRef.current) return;
          updateSelection();
          if (!dragRef.current && !inertiaFrameRef.current) scheduleReturn();
        }}>
        <div className="lyric-lines" ref={contentRef}>
          {lyric.lines.map((line, i) => (
            <LyricRow key={`${line.time}-${i}`} line={line} index={i} active={i === activeIndex}
              selected={pending && i === seekIndex} register={registerLine} />
          ))}
        </div>
      </div>
      <div className="lyric-seekline" ref={seekLineRef} />
      <div className="lyric-seekbar" ref={seekBarRef}>
        <span className="s-time">{fmtTime((seekLine?.time ?? 0) / 1000)}</span>
        <button type="button" className="s-play" aria-label="跳转到选中歌词"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); commitSeek(); }}>
          <Icon name="play" size={12} filled />
        </button>
      </div>
    </div>
  );
});
