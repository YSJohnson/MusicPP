import { useNavigate } from 'react-router-dom';
import type { Playlist } from '../api/types';
import { fmtCount } from '../lib/format';
import { cn } from '../lib/cn';
import { Cover } from './Cover';
import { Icon } from './Icon';

interface PlaylistCardProps {
  playlist: Playlist;
  onClick?: () => void;
  variant?: 'grid' | 'rail';
}

export function PlaylistCard({ playlist, onClick, variant = 'grid' }: PlaylistCardProps) {
  const navigate = useNavigate();
  const handle = onClick ?? (() => navigate(`/playlist/${encodeURIComponent(playlist.id)}`));

  return (
    <button className={cn('pl-card', variant === 'rail' && 'h-card')} onClick={handle}>
      <div className="art">
        <Cover src={playlist.cover} alt={playlist.name} size={360} />
        <span className="veil" />
        {!!playlist.playCount && (
          <span className="play-count">
            <Icon name="play" size={8} filled />
            {fmtCount(playlist.playCount)}
          </span>
        )}
        <span className="mini-play">
          <Icon name="play" size={13} />
        </span>
      </div>
      <div className="name">{playlist.name}</div>
      <div className="sub">
        {playlist.creator ? playlist.creator : '酷狗歌单'}
        {playlist.count ? ` · ${playlist.count}首` : ''}
      </div>
    </button>
  );
}
