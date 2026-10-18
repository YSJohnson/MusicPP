import { useNavigate, useParams } from 'react-router-dom';
import { getDailySongs, getNewSongs, getPersonalFm } from '../api';
import type { Song } from '../api/types';
import { useRequest } from '../hooks/useRequest';
import { usePlayer } from '../store/player';
import { Icon } from '../components/Icon';
import { SongList } from '../components/SongList';
import { SkeletonRows } from '../components/EmptyState';
import { InlineError } from './Home';

const META: Record<string, { title: string; kicker: string; desc: string }> = {
  daily: { title: '每日推荐', kicker: 'DAILY MIX', desc: '根据你的口味生成，每天 6:00 更新' },
  fm: { title: '猜你喜欢', kicker: 'FOR YOU', desc: '来自私人 FM 的即时推荐' },
  newsong: { title: '新歌速递', kicker: 'NEW RELEASES', desc: '全网最新上架单曲' },
};

export function ListPage() {
  const navigate = useNavigate();
  const { kind = 'daily' } = useParams();
  const meta = META[kind] ?? META.daily;
  const playQueue = usePlayer((s) => s.playQueue);

  const req = useRequest<Song[]>(() => {
    if (kind === 'fm') return getPersonalFm();
    if (kind === 'newsong') return getNewSongs(1, 50);
    return getDailySongs();
  }, [kind]);

  const songs = req.data ?? [];

  return (
    <div className="page">
      <header className="detail-head">
        <button className="icon-btn" onClick={() => navigate(-1)} aria-label="返回">
          <Icon name="chevronLeft" size={20} />
        </button>
        <div className="title">{meta.title}</div>
        <div className="head-actions">
          {kind !== 'daily' && (
            <button className="icon-btn" onClick={req.reload} aria-label="换一批">
              <Icon name="refresh" size={17} />
            </button>
          )}
        </div>
      </header>

      <div className="detail-hero">
        <div className="body" style={{ alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <div className="eyebrow" style={{ color: 'var(--label-2)' }}>
              {meta.kicker}
            </div>
            <h1 style={{ fontSize: 26, fontWeight: 820, letterSpacing: '-0.03em', marginTop: 8 }}>
              {meta.title}
            </h1>
            <p className="dim" style={{ fontSize: 11.5, marginTop: 8 }}>
              {meta.desc}
              {songs.length ? ` · 共 ${songs.length} 首` : ''}
            </p>
          </div>
        </div>
      </div>

      <div className="detail-actions">
        <button
          className="play-all"
          onClick={() => songs.length && void playQueue(songs, 0, meta.title)}
        >
          <Icon name="play" size={15} filled />
          播放全部
        </button>
        <button
          className="round"
          aria-label="随机播放"
          onClick={() => {
            if (!songs.length) return;
            void playQueue(songs, Math.floor(Math.random() * songs.length), meta.title);
          }}
        >
          <Icon name="shuffle" size={18} />
        </button>
      </div>

      {req.loading ? (
        <SkeletonRows count={8} />
      ) : req.error ? (
        <InlineError onRetry={req.reload} />
      ) : (
        <SongList songs={songs} context={meta.title} showIndex />
      )}
    </div>
  );
}
