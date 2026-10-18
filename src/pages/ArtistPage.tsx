import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getArtistDetail, getArtistSongs } from '../api';
import type { ArtistSummary, Song } from '../api/types';
import { coverUrl, fmtCount } from '../lib/format';
import { cn } from '../lib/cn';
import { useRequest } from '../hooks/useRequest';
import { usePlayer } from '../store/player';
import { Cover } from '../components/Cover';
import { EmptyState, SkeletonRows } from '../components/EmptyState';
import { Icon } from '../components/Icon';
import { SongList } from '../components/SongList';
import { InlineError } from './Home';

export function ArtistPage() {
  const navigate = useNavigate();
  const { id = '' } = useParams();
  const playQueue = usePlayer((s) => s.playQueue);
  const [sort, setSort] = useState<'hot' | 'new'>('hot');

  const req = useRequest<{ artist: ArtistSummary | null; songs: Song[] }>(async () => {
    const key = decodeURIComponent(id);
    const artist = await getArtistDetail(key).catch(() => null);
    const res = await getArtistSongs(key, 1, 60, sort).catch(() => ({ songs: [], total: 0 }));
    return { artist, songs: res.songs };
  }, [id, sort]);

  const artist = req.data?.artist;
  const songs = req.data?.songs ?? [];
  const bg = coverUrl(artist?.avatar, 300);

  return (
    <div className="page">
      <header className="detail-head">
        <button className="icon-btn" onClick={() => navigate(-1)} aria-label="返回">
          <Icon name="chevronLeft" size={20} />
        </button>
        <div className="title">{artist?.name ?? '歌手'}</div>
      </header>

      <div className="detail-hero">
        {bg && <div className="bg-blur" style={{ backgroundImage: `url("${bg}")` }} />}
        <div className="body" style={{ alignItems: 'center' }}>
          <Cover
            className="cover round"
            src={artist?.avatar}
            alt={artist?.name}
            size={420}
            iconSize={26}
          />
          <div className="intro">
            <div className="eyebrow" style={{ color: 'var(--label-2)' }}>
              ARTIST
            </div>
            <h1 style={{ marginTop: 6, WebkitLineClamp: 1 }}>{artist?.name ?? '正在加载…'}</h1>
            <div className="meta">
              {artist?.songCount ? <span>{fmtCount(artist.songCount)} 首单曲</span> : null}
              {artist?.albumCount ? (
                <>
                  <span className="dot" />
                  <span>{artist.albumCount} 张专辑</span>
                </>
              ) : null}
              {artist?.fans ? (
                <>
                  <span className="dot" />
                  <span>{fmtCount(artist.fans)} 粉丝</span>
                </>
              ) : null}
            </div>
            {artist?.intro && <div className="desc">{artist.intro}</div>}
          </div>
        </div>
      </div>

      <div className="detail-actions">
        <button
          className="play-all"
          disabled={!songs.length}
          onClick={() => songs.length && void playQueue(songs, 0, artist?.name ?? '歌手')}
        >
          <Icon name="play" size={15} filled />
          播放全部
        </button>
        <button
          className="round"
          aria-label="随机播放"
          onClick={() => {
            if (!songs.length) return;
            void playQueue(songs, Math.floor(Math.random() * songs.length), artist?.name ?? '歌手');
          }}
        >
          <Icon name="shuffle" size={18} />
        </button>
      </div>

      <div className="chips" style={{ marginTop: 6 }}>
        <button className={cn('chip', sort === 'hot' && 'active')} onClick={() => setSort('hot')}>
          热门单曲
        </button>
        <button className={cn('chip', sort === 'new' && 'active')} onClick={() => setSort('new')}>
          最新发布
        </button>
      </div>

      {req.loading ? (
        <SkeletonRows count={8} />
      ) : req.error ? (
        <InlineError onRetry={req.reload} />
      ) : !songs.length ? (
        <EmptyState icon="user" text="暂时没有获取到这位歌手的歌曲" />
      ) : (
        <SongList songs={songs} context={artist?.name ?? '歌手'} showIndex />
      )}

      <div style={{ height: 20 }} />
    </div>
  );
}
