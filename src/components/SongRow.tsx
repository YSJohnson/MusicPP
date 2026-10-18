import type { ReactNode } from 'react';
import type { Song } from '../api/types';
import { fmtDuration } from '../lib/format';
import { cn } from '../lib/cn';
import { Cover } from './Cover';
import { Icon } from './Icon';

interface SongRowProps {
  song: Song;
  index?: number;
  active?: boolean;
  playing?: boolean;
  showCover?: boolean;
  showIndex?: boolean;
  onPlay: () => void;
  onMore?: () => void;
  tail?: ReactNode;
}

export function SongRow({
  song,
  index,
  active,
  playing,
  showCover = true,
  showIndex = false,
  onPlay,
  onMore,
  tail,
}: SongRowProps) {
  return (
    <div
      className={cn('song-row', active && 'playing')}
      role="button"
      tabIndex={0}
      onClick={onPlay}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onPlay();
      }}
    >
      {showIndex && (
        <div className="song-index">
          {active ? (
            <span className={cn('eq', !playing && 'paused')} style={{ marginLeft: 2 }}>
              <i />
              <i />
              <i />
            </span>
          ) : (
            (index ?? 0) + 1
          )}
        </div>
      )}

      {showCover && <Cover className="song-cover" src={song.cover} alt={song.name} size={180} />}

      <div className="song-main">
        <div className="song-name">
          <span className="txt">{song.name}</span>
          {song.vip && <span className="badge vip">VIP</span>}
        </div>
        <div className="song-sub">
          <span className="ellipsis">{song.artist}</span>
          {song.album && (
            <>
              <span className="dot" />
              <span className="ellipsis">{song.album}</span>
            </>
          )}
        </div>
      </div>

      <div className="song-tail">
        {tail}
        <span className="song-dur mono">{fmtDuration(song.duration)}</span>
        {onMore && (
          <button
            className="song-more"
            aria-label="更多"
            onClick={(e) => {
              e.stopPropagation();
              onMore();
            }}
          >
            <Icon name="more" size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
