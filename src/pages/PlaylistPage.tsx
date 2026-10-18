import { useNavigate, useParams } from 'react-router-dom';
import { getPlaylistDetail, getPlaylistSongs, getUserPlaylistSongs } from '../api';
import type { PlaylistDetail, Song } from '../api/types';
import { coverUrl, fmtCount } from '../lib/format';
import { useRequest } from '../hooks/useRequest';
import { usePlayer } from '../store/player';
import { Cover } from '../components/Cover';
import { EmptyState, SkeletonRows } from '../components/EmptyState';
import { Icon } from '../components/Icon';
import { SongList } from '../components/SongList';
import { InlineError } from './Home';

interface Loaded {
  detail: PlaylistDetail | null;
  songs: Song[];
  total: number;
}

export function PlaylistPage() {
  const navigate = useNavigate();
  const { id = '' } = useParams();
  const playQueue = usePlayer((s) => s.playQueue);

  const req = useRequest<Loaded>(async () => {
    const key = decodeURIComponent(id);
    const detail = await getPlaylistDetail(key).catch(() => null);
    let songs: Song[] = [];
    let total = 0;
    if (detail) {
      const res = await getPlaylistSongs(key, 1, 300).catch(() => null);
      if (res) {
        songs = res.songs;
        total = res.total;
      }
    }
    if (!songs.length) {
      const res = await getUserPlaylistSongs(key, 1, 300).catch(() => null);
      if (res) {
        songs = res.songs;
        total = res.total;
      }
    }
    return { detail, songs, total };
  }, [id]);

  const detail = req.data?.detail;
  const songs = req.data?.songs ?? [];
  const total = req.data?.total || songs.length;
  const bg = coverUrl(detail?.cover, 300);

  return (
    <div className="page">
      <header className="detail-head">
        <button className="icon-btn" onClick={() => navigate(-1)} aria-label="返回">
          <Icon name="chevronLeft" size={20} />
        </button>
        <div className="title">{detail?.name ?? '歌单'}</div>
        <div className="head-actions">
          <button className="icon-btn" onClick={req.reload} aria-label="刷新">
            <Icon name="refresh" size={17} />
          </button>
        </div>
      </header>

      {(detail || req.loading) && (
        <div className="detail-hero">
          {bg && <div className="bg-blur" style={{ backgroundImage: `url("${bg}")` }} />}
          <div className="body">
            <Cover className="cover" src={detail?.cover} alt={detail?.name} size={420} iconSize={26} />
            <div className="intro">
              <div className="eyebrow" style={{ color: 'var(--label-2)' }}>
                PLAYLIST
              </div>
              <h1 style={{ marginTop: 6 }}>{detail?.name ?? '正在加载…'}</h1>
              {detail?.creator && (
                <div className="creator">
                  <Icon name="user" size={13} />
                  {detail.creator}
                </div>
              )}
              <div className="meta">
                <span>{total || detail?.count || 0} 首</span>
                {!!detail?.playCount && (
                  <>
                    <span className="dot" />
                    <span>{fmtCount(detail.playCount)} 次播放</span>
                  </>
                )}
              </div>
              {!!detail?.tags?.length && (
                <div className="meta" style={{ marginTop: 6 }}>
                  {detail.tags.slice(0, 3).map((t) => (
                    <span key={t} className="hot-tag" style={{ height: 24, fontSize: 10.5, padding: '0 9px' }}>
                      {t}
                    </span>
                  ))}
                </div>
              )}
              {detail?.description && <div className="desc">{detail.description}</div>}
            </div>
          </div>
        </div>
      )}

      <div className="detail-actions">
        <button
          className="play-all"
          onClick={() => songs.length && void playQueue(songs, 0, detail?.name ?? '歌单')}
          disabled={!songs.length}
        >
          <Icon name="play" size={15} filled />
          播放全部
        </button>
        <button
          className="round"
          aria-label="随机播放"
          onClick={() => {
            if (!songs.length) return;
            void playQueue(songs, Math.floor(Math.random() * songs.length), detail?.name ?? '歌单');
          }}
        >
          <Icon name="shuffle" size={18} />
        </button>
      </div>

      <div className="list-caption">
        <span>歌曲列表</span>
        <span>{songs.length ? `${songs.length} 首` : ''}</span>
      </div>

      {req.loading ? (
        <SkeletonRows count={8} />
      ) : req.error ? (
        <InlineError onRetry={req.reload} />
      ) : !songs.length ? (
        <EmptyState icon="music" text="这个歌单暂时没有可播放的歌曲" />
      ) : (
        <SongList songs={songs} context={detail?.name ?? '歌单'} showIndex />
      )}

      <div style={{ height: 20 }} />
    </div>
  );
}
