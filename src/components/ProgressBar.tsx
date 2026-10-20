import { useCallback, useRef, useState } from 'react';
import { usePlaybackFrame } from '../hooks/usePlaybackFrame';
import { getPlaybackTime } from '../store/player';
import { fmtTime } from '../lib/format';
import { cn } from '../lib/cn';

interface ProgressProps {
  duration: number;
  climaxStart?: number | null;
  onSeek: (time: number) => void;
}

export function ProgressBar({ duration, climaxStart, onSeek }: ProgressProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<number | null>(null);
  const pointerRef = useRef<number | null>(null);
  const [dragValue, setDragValue] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(() => Math.floor(getPlaybackTime()));
  const elapsedRef = useRef(elapsed);
  const hasClimax = climaxStart != null && Number.isFinite(climaxStart) && climaxStart >= 0 && climaxStart < duration;

  const paint = (time: number) => {
    const current = dragRef.current ?? time;
    const ratio = duration > 0 ? Math.min(1, Math.max(0, current / duration)) : 0;
    if (fillRef.current) fillRef.current.style.transform = `scaleX(${ratio})`;
    if (thumbRef.current) thumbRef.current.style.left = `${ratio * 100}%`;
    const seconds = Math.floor(current);
    if (seconds !== elapsedRef.current) {
      elapsedRef.current = seconds;
      setElapsed(seconds);
    }
  };
  usePlaybackFrame(paint);

  const valueAt = useCallback(
    (clientX: number) => {
      const rect = trackRef.current?.getBoundingClientRect();
      if (!rect || rect.width === 0) return 0;
      const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      return ratio * duration;
    },
    [duration],
  );

  const preview = (value: number | null) => {
    dragRef.current = value;
    setDragValue(value);
    paint(getPlaybackTime());
  };

  return (
    <div className="progress-block">
      <div
        className={cn('progress-bar', dragValue !== null && 'dragging')}
        onPointerDown={(e) => {
          if (!e.isPrimary || e.button !== 0) return;
          pointerRef.current = e.pointerId;
          e.currentTarget.setPointerCapture(e.pointerId);
          preview(valueAt(e.clientX));
        }}
        onPointerMove={(e) => {
          if (pointerRef.current === e.pointerId && dragRef.current !== null) preview(valueAt(e.clientX));
        }}
        onPointerUp={(e) => {
          if (pointerRef.current !== e.pointerId || dragRef.current === null) return;
          pointerRef.current = null;
          const v = valueAt(e.clientX);
          onSeek(v);
          preview(null);
        }}
        onPointerCancel={() => { pointerRef.current = null; preview(null); }}
        onLostPointerCapture={() => { pointerRef.current = null; preview(null); }}
      >
        <div className="track" ref={trackRef}>
          <div className="fill" ref={fillRef} />
          <div className="thumb" ref={thumbRef} />
          {hasClimax && (
            <button
              type="button"
              className="climax-marker"
              style={{ left: `${climaxStart! / duration * 100}%` }}
              aria-label={`高潮起点 ${fmtTime(climaxStart!)}`}
              title={`高潮 ${fmtTime(climaxStart!)}`}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); onSeek(climaxStart!); }}
            />
          )}
        </div>
      </div>
      <div className="time-row">
        <span>{fmtTime(dragValue ?? elapsed)}</span>
        <span>{fmtTime(duration)}</span>
      </div>
    </div>
  );
}
