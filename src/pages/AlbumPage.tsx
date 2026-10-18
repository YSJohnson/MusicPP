import { useNavigate, useParams } from 'react-router-dom';
import { getAlbumDetail, getAllAlbumSongs } from '../api';
import type { AlbumSummary, Song } from '../api/types';
import { coverUrl } from '../lib/format';
import { useRequest } from '../hooks/useRequest';
import { usePlayer } from '../store/player';
import { Cover } from '../components/Cover';
import { EmptyState, SkeletonRows } from '../components/EmptyState';
import { Icon } from '../components/Icon';
import { SongList } from '../components/SongList';
import { InlineError } from './Home';

export function AlbumPage() {
  const navigate = useNavigate();
  const { id = '' } = useParams();
  const playQueue = usePlayer((s) => s.playQueue);

  const req = useRequest<{ album: AlbumSummary | null; songs: Song[] }>(async () => {
    const key = decodeURIComponent(id);
    const album = await getAlbumDetail(key).catch(() => null);
    const res = await getAllAlbumSongs(key).catch(() => ({ songs: [], total: 0 }));
    return { album, songs: res.songs };
  }, [id]);

  const album = req.data?.album;
  const songs = req.data?.songs ?? [];
  const bg = coverUrl(album?.cover, 300);

  return (
    <div className="page">
      <header className="detail-head">
        <button className="icon-btn" onClick={() => navigate(-1)} aria-label="返回">
          <Icon name="chevronLeft" size={20} />
        </button>
        <div className="title">专辑</div>
      </header>

      <div className="detail-hero">
        {bg && <div className="bg-blur" style={{ backgroundImage: `url("${bg}")` }} />}
        <div className="body">
          <Cover className="cover" src={album?.cover} alt={album?.name} size={420} iconSize={26} />
          <div className="intro">
            <div className="eyebrow" style={{ color: 'var(--label-2)' }}>
              ALBUM
            </div>
            <h1 style={{ marginTop: 6 }}>{album?.name ?? '正在加载…'}</h1>
            {album?.artist && (
              <div className="creator" onClick={() => album.artistId && navigate(`/artist/${album.artistId}`)}>
                <Icon name="user" size={13} />
                {album.artist}
              </div>
            )}
            <div className="meta">
              {album?.publishDate && <span>{album.publishDate.slice(0, 10)}</span>}
              {!!songs.length && (
                <>
                  <span className="dot" />
                  <span>{songs.length} 首</span>
                </>
              )}
              {album?.language && (
                <>
                  <span className="dot" />
                  <span>{album.language}</span>
                </>
              )}
            </div>
            {album?.intro && <div className="desc">{album.intro}</div>}
          </div>
        </div>
      </div>

      <div className="detail-actions">
        <button
          className="play-all"
          disabled={!songs.length}
          onClick={() => songs.length && void playQueue(songs, 0, album?.name ?? '专辑')}
        >
          <Icon name="play" size={15} filled />
          播放全部
        </button>
        <button
          className="round"
          aria-label="随机播放"
          onClick={() => {
            if (!songs.length) return;
            void playQueue(songs, Math.floor(Math.random() * songs.length), album?.name ?? '专辑');
          }}
        >
          <Icon name="shuffle" size={18} />
        </button>
      </div>

      <div className="list-caption">
        <span>曲目</span>
        <span>{songs.length ? `${songs.length} 首` : ''}</span>
      </div>

      {req.loading ? (
        <SkeletonRows count={7} />
      ) : req.error ? (
        <InlineError onRetry={req.reload} />
      ) : !songs.length ? (
        <EmptyState icon="disc" text="暂时没有获取到这张专辑的曲目" />
      ) : (
        <SongList songs={songs} context={album?.name ?? '专辑'} showIndex showCover={false} />
      )}

      <div style={{ height: 20 }} />
    </div>
  );
}
