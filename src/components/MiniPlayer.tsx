import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlayer } from '../store/player';
import { cn } from '../lib/cn';
import { Cover } from './Cover';
import { Icon } from './Icon';

export function MiniPlayer() {
  const navigate = useNavigate();
  const queue = usePlayer((s) => s.queue);
  const index = usePlayer((s) => s.index);
  const playing = usePlayer((s) => s.playing);
  const loading = usePlayer((s) => s.loading);
  const time = usePlayer((s) => s.time);
  const duration = usePlayer((s) => s.duration);
  const toggle = usePlayer((s) => s.toggle);
  const next = usePlayer((s) => s.next);
  const ref = useRef<HTMLDivElement>(null);

  const song = queue[index];
  if (!song) return null;

  const pct = duration > 0 ? Math.min(100, (time / duration) * 100) : 0;

  const trackHighlight = (e: React.PointerEvent) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty('--hx', `${(((e.clientX - rect.left) / rect.width) * 100).toFixed(1)}%`);
    el.style.setProperty('--hy', `${(((e.clientY - rect.top) / rect.height) * 100).toFixed(1)}%`);
  };

  return (
    <div
      className={cn('mini', playing && 'playing')}
      ref={ref}
      role="button"
      tabIndex={0}
      onPointerMove={trackHighlight}
      onClick={() => navigate('/player')}
      onKeyDown={(e) => {
        if (e.key === 'Enter') navigate('/player');
      }}
    >
      <span className="lg-inner" aria-hidden>
        <span className="lg" />
        <span className="lg-noise" />
      </span>
      <div className="cover-wrap">
        <Cover className="cover" src={song.cover} alt={song.name} size={140} />
        <span className="halo" />
      </div>
      <div className="info">
        <div className="t">{song.name}</div>
        <div className="s">
          {song.artist}
          {queue.length > 1 ? ` · ${index + 1}/${queue.length}` : ''}
        </div>
      </div>
      <div className="ctrls" onClick={(e) => e.stopPropagation()}>
        <button
          className="play-btn"
          aria-label={playing ? '暂停' : '播放'}
          onClick={() => void toggle()}
        >
          {loading ? (
            <Icon name="disc" size={18} className="spin" />
          ) : (
            <Icon name={playing ? 'pause' : 'play'} size={18} />
          )}
        </button>
        <button className="icon-btn" aria-label="下一首" onClick={() => void next()}>
          <Icon name="next" size={18} />
        </button>
      </div>
      <div className="progress">
        <i style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
