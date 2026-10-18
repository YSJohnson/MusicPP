import { useNavigate, useParams } from 'react-router-dom';
import { getRankSongs, getRanks } from '../api';
import type { RankInfo, Song } from '../api/types';
import { coverUrl, fmtCount } from '../lib/format';
import { useRequest } from '../hooks/useRequest';
import { usePlayer } from '../store/player';
import { Cover } from '../components/Cover';
import { EmptyState, SkeletonRows } from '../components/EmptyState';
import { Icon } from '../components/Icon';
import { SongList } from '../components/SongList';
import { InlineError } from './Home';

export function RankPage() {
  const navigate = useNavigate();
  const { id = '' } = useParams();
  const playQueue = usePlayer((s) => s.playQueue);

  const req = useRequest<{ info: RankInfo | null; songs: Song[]; total: number }>(async () => {
    const ranks = await getRanks().catch(() => [] as RankInfo[]);
    const info = ranks.find((r) => String(r.id) === String(id)) ?? null;
    const res = await getRankSongs(id, 1, 100).catch(() => ({ songs: [], total: 0 }));
    return { info, songs: res.songs, total: res.total };
  }, [id]);

  const info = req.data?.info;
  const songs = req.data?.songs ?? [];
  const bg = coverUrl(info?.cover, 300);

  return (
    <div className="page">
      <header className="detail-head">
        <button className="icon-btn" onClick={() => navigate(-1)} aria-label="返回">
          <Icon name="chevronLeft" size={20} />
        </button>
        <div className="title">{info?.name ?? '排行榜'}</div>
      </header>

      <div className="detail-hero">
        {bg && <div className="bg-blur" style={{ backgroundImage: `url("${bg}")` }} />}
        <div className="body">
          <Cover className="cover" src={info?.cover} alt={info?.name} size={420} iconSize={26} />
          <div className="intro">
            <div className="eyebrow" style={{ color: 'var(--label-2)' }}>
              CHART
            </div>
            <h1 style={{ marginTop: 6 }}>{info?.name ?? '排行榜'}</h1>
            <div className="meta">
              {info?.updateFrequency && <span>{info.updateFrequency}</span>}
              {info?.playTimes ? (
                <>
                  <span className="dot" />
                  <span>{fmtCount(info.playTimes)} 次播放</span>
                </>
              ) : null}
              {songs.length ? (
                <>
                  <span className="dot" />
                  <span>{songs.length} 首</span>
                </>
              ) : null}
            </div>
            {info?.intro && <div className="desc">{info.intro}</div>}
          </div>
        </div>
      </div>

      <div className="detail-actions">
        <button
          className="play-all"
          disabled={!songs.length}
          onClick={() => songs.length && void playQueue(songs, 0, info?.name ?? '排行榜')}
        >
          <Icon name="play" size={15} filled />
          播放全部
        </button>
        <button
          className="round"
          aria-label="随机播放"
          onClick={() => {
            if (!songs.length) return;
            void playQueue(songs, Math.floor(Math.random() * songs.length), info?.name ?? '排行榜');
          }}
        >
          <Icon name="shuffle" size={18} />
        </button>
      </div>

      {req.loading ? (
        <SkeletonRows count={8} />
      ) : req.error ? (
        <InlineError onRetry={req.reload} />
      ) : !songs.length ? (
        <EmptyState icon="trending" text="暂时没有获取到榜单歌曲" />
      ) : (
        <SongList songs={songs} context={info?.name ?? '排行榜'} showIndex showCover={false} />
      )}

      <div style={{ height: 20 }} />
    </div>
  );
}

export function RanksPage() {
  const navigate = useNavigate();
  const req = useRequest(getRanks, []);
  const ranks = req.data ?? [];

  return (
    <div className="page">
      <header className="detail-head">
        <button className="icon-btn" onClick={() => navigate(-1)} aria-label="返回">
          <Icon name="chevronLeft" size={20} />
        </button>
        <div className="title">排行榜</div>
      </header>

      <div className="page-inner" style={{ paddingTop: 10 }}>
        <div className="eyebrow" style={{ color: 'var(--label-2)' }}>
          ALL CHARTS
        </div>
        <div className="h1" style={{ margin: '6px 0 16px' }}>
          全部榜单
        </div>
      </div>

      {req.loading ? (
        <div className="grid-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton" style={{ height: 150, borderRadius: 18 }} />
          ))}
        </div>
      ) : (
        <div className="grid-2 rank-grid">
          {ranks.map((r) => (
            <button
              key={r.id}
              className="rank-card tap"
              onClick={() => navigate(`/rank/${r.id}`)}
            >
              <div className="art">
                <Cover src={r.cover} alt={r.name} size={360} />
              </div>
              <div className="body">
                <div className="t">{r.name}</div>
                <div className="meta">
                  <span>{r.updateFrequency ?? '每日更新'}</span>
                  {r.playTimes ? <span className="num">{fmtCount(r.playTimes)}</span> : null}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      <div style={{ height: 24 }} />
    </div>
  );
}
