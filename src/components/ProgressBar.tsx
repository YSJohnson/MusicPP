import { useCallback, useRef, useState } from 'react';
import { fmtTime } from '../lib/format';
import { cn } from '../lib/cn';

interface ProgressProps {
  time: number;
  duration: number;
  onSeek: (time: number) => void;
}

export function ProgressBar({ time, duration, onSeek }: ProgressProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragValue, setDragValue] = useState<number | null>(null);

  const valueAt = useCallback(
    (clientX: number) => {
      const rect = trackRef.current?.getBoundingClientRect();
      if (!rect || rect.width === 0) return 0;
      const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      return ratio * duration;
    },
    [duration],
  );

  const current = dragValue ?? time;
  const pct = duration > 0 ? Math.min(100, (current / duration) * 100) : 0;

  return (
    <div className="progress-block">
      <div
        className={cn('progress-bar', dragValue !== null && 'dragging')}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          setDragValue(valueAt(e.clientX));
        }}
        onPointerMove={(e) => {
          if (dragValue === null) return;
          setDragValue(valueAt(e.clientX));
        }}
        onPointerUp={(e) => {
          if (dragValue === null) return;
          const v = valueAt(e.clientX);
          setDragValue(null);
          onSeek(v);
        }}
        onPointerCancel={() => setDragValue(null)}
      >
        <div className="track" ref={trackRef}>
          <div className="fill" style={{ width: `${pct}%` }} />
          <div className="thumb" style={{ left: `${pct}%` }} />
        </div>
      </div>
      <div className="time-row">
        <span>{fmtTime(current)}</span>
        <span>{fmtTime(duration)}</span>
      </div>
    </div>
  );
}
