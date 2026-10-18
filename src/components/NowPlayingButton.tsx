import { useNavigate } from 'react-router-dom';
import { usePlayer } from '../store/player';
import { Cover } from './Cover';
import { Icon } from './Icon';

const R = 46;
const CIRC = 2 * Math.PI * R;

/** 底栏中间的“正在播放”：圆形封面 + 进度环，点击进入播放器 */
export function NowPlayingButton() {
  const navigate = useNavigate();
  const queue = usePlayer((s) => s.queue);
  const index = usePlayer((s) => s.index);
  const playing = usePlayer((s) => s.playing);
  const time = usePlayer((s) => s.time);
  const duration = usePlayer((s) => s.duration);

  const song = queue[index];
  const pct = duration > 0 ? Math.min(1, time / duration) : 0;

  return (
    <button
      className="now-btn"
      aria-label={song ? `正在播放：${song.name}` : '播放器'}
      onClick={() => navigate(song ? '/player' : '/')}
    >
      <span className="now-ring" aria-hidden>
        <svg viewBox="0 0 100 100">
          <circle className="ring-bg" cx="50" cy="50" r={R} />
          <circle
            className="ring-fg"
            cx="50"
            cy="50"
            r={R}
            style={{ strokeDasharray: CIRC, strokeDashoffset: CIRC * (1 - pct) }}
          />
        </svg>
      </span>
      <span className="now-art">
        {song ? (
          <Cover src={song.cover} alt={song.name} size={140} />
        ) : (
          <Icon name="music" size={20} />
        )}
        {song && !playing && (
          <span className="now-paused">
            <Icon name="play" size={12} filled />
          </span>
        )}
      </span>
    </button>
  );
}
