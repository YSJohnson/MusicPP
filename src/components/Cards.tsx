import { useNavigate } from 'react-router-dom';
import type { RankInfo, Song } from '../api/types';
import { fmtCount } from '../lib/format';
import { Cover } from './Cover';
import { Icon } from './Icon';

export function RankCard({ rank }: { rank: RankInfo }) {
  const navigate = useNavigate();
  return (
    <button className="rank-card tap" onClick={() => navigate(`/rank/${rank.id}`)}>
      <div className="art">
        <Cover src={rank.cover} alt={rank.name} size={200} />
      </div>
      <div className="body">
        <div className="t">{rank.name}</div>
        <div className="meta">
          <span>{rank.updateFrequency ?? '每日更新'}</span>
          {rank.playTimes ? <span className="num">{fmtCount(rank.playTimes)}</span> : null}
        </div>
      </div>
    </button>
  );
}

export function SongCard({ song, onPlay }: { song: Song; onPlay: () => void }) {
  return (
    <button className="song-card tap" onClick={onPlay}>
      <div className="art">
        <Cover src={song.cover} alt={song.name} size={300} />
        <span className="veil" />
        <span className="play-fab">
          <Icon name="play" size={12} filled />
        </span>
      </div>
      <div className="name">{song.name}</div>
      <div className="sub">{song.artist}</div>
    </button>
  );
}
