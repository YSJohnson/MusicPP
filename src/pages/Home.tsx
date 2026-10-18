import { useNavigate } from 'react-router-dom';
import {
  getDailySongs,
  getHomeDiscover,
  getNewSongs,
  getPlaylists,
  getRanks,
} from '../api';
import type { Song } from '../api/types';
import { useRequest } from '../hooks/useRequest';
import { fmtDate, greeting } from '../lib/format';
import { usePlayer } from '../store/player';
import { useSettings } from '../store/settings';
import { useToast } from '../store/toast';
import { Cover } from '../components/Cover';
import { RankCard, SongCard } from '../components/Cards';
import { Icon } from '../components/Icon';
import { PlaylistCard } from '../components/PlaylistCard';
import { SectionHeader } from '../components/SectionHeader';
import { SkeletonGrid } from '../components/EmptyState';

export function HomePage() {
  const navigate = useNavigate();
  const playQueue = usePlayer((s) => s.playQueue);
  const toast = useToast((s) => s.show);

  const daily = useRequest(getDailySongs, []);
  const discover = useRequest(() => getHomeDiscover(8), []);
  const playlists = useRequest(() => getPlaylists(0, 1, 6), []);
  const ranks = useRequest(getRanks, []);
  const newSongs = useRequest(() => getNewSongs(1, 12), []);
  const lastPlayed = useSettings((s) => s.lastPlayed);
  const apiBase = useSettings((s) => s.apiBase);

  const now = new Date();
  const dailySongs = daily.data ?? [];

  const netError = daily.error || discover.error || playlists.error || ranks.error || newSongs.error;
  const offline = !!netError && /无法连接|超时/.test(netError);

  const playDaily = () => {
    if (!dailySongs.length) {
      toast(daily.loading ? '正在加载每日推荐…' : '每日推荐加载失败', 'warn');
      return;
    }
    void playQueue(dailySongs, 0, '每日推荐');
  };

  const playOne = (list: Song[], song: Song) => {
    const index = list.findIndex((s) => s.hash === song.hash);
    void playQueue(list, index < 0 ? 0 : index, '为你推荐');
  };

  return (
    <div className="page">
      <header className="hero-head">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div className="greet">{greeting(now)}</div>
            <div className="brand">
              <h1>现在就听</h1>
            </div>
            <div className="date">{fmtDate(now)}</div>
          </div>
          <button className="icon-btn" aria-label="搜索" onClick={() => navigate('/search')}>
            <Icon name="search" size={21} />
          </button>
        </div>
      </header>

      {offline && (
        <div className="conn-banner">
          <span className="ic">
            <Icon name="wifi" size={16} />
          </span>
          <div className="txt">
            <b>{apiBase ? '无法连接 API 服务器' : '网络连接失败'}</b>
            <span>{apiBase || '请检查手机网络后重试'}</span>
          </div>
          <button
            onClick={() => {
              if (apiBase) navigate('/settings');
              else {
                daily.reload();
                discover.reload();
                playlists.reload();
                ranks.reload();
                newSongs.reload();
              }
            }}
          >
            {apiBase ? '去设置' : '重试'}
          </button>
        </div>
      )}

      <section
        className="daily-hero tap"
        onClick={() => navigate('/list/daily')}
        role="button"
        tabIndex={0}
        style={
          dailySongs[0]?.cover
            ? { backgroundImage: `url("${dailySongs[0].cover}")` }
            : undefined
        }
      >
        <div className="kicker">为你定制</div>
        <h2>每日推荐</h2>
        <p className="desc">
          根据你的收听习惯生成
          {dailySongs.length ? ` · 今日 ${dailySongs.length} 首` : ' · 每天 6:00 更新'}
        </p>
        <div className="cta">
          <button
            className="play-pill"
            onClick={(e) => {
              e.stopPropagation();
              playDaily();
            }}
          >
            <Icon name="play" size={14} filled />
            播放
          </button>
          <button
            className="ghost-pill"
            onClick={(e) => {
              e.stopPropagation();
              navigate('/list/daily');
            }}
          >
            查看全部
          </button>
        </div>
      </section>

      <div className="quick-grid">
        <QuickButton
          icon="sparkle"
          tone="lime"
          label="猜你喜欢"
          onClick={() => navigate('/list/fm')}
        />
        <QuickButton
          icon="trending"
          tone="violet"
          label="排行榜"
          onClick={() => navigate('/ranks')}
        />
        <QuickButton
          icon="calendar"
          tone="cyan"
          label="每日推荐"
          onClick={() => navigate('/list/daily')}
        />
      </div>

      {lastPlayed && (
        <button
          className="resume-card tap"
          onClick={() => {
            const { queue, index, time } = lastPlayed;
            void playQueue(queue, index, '继续播放').then(() => {
              if (time > 1) window.setTimeout(() => usePlayer.getState().seek(time), 700);
            });
          }}
        >
          <Cover className="cover" src={lastPlayed.song.cover} alt="" size={160} />
          <div className="info">
            <div className="t">{lastPlayed.song.name}</div>
            <div className="s">
              <Icon name="clock" size={11} />
              上次听到 {lastPlayed.song.artist}
            </div>
            <div className="bar">
              <i
                style={{
                  width: `${Math.min(
                    100,
                    lastPlayed.song.duration > 0
                      ? (lastPlayed.time / lastPlayed.song.duration) * 100
                      : 0,
                  )}%`,
                }}
              />
            </div>
          </div>
          <span className="play">
            <Icon name="play" size={15} filled />
          </span>
        </button>
      )}

      {discover.data && discover.data.length > 0 && (
        <section className="section">
          <SectionHeader kicker="FOR YOU" title="为你推荐" more="换一批" onMore={discover.reload} />
          <div className="feed">
            {discover.data.map((song) => (
              <button
                key={song.hash}
                className="feed-card"
                onClick={() => playOne(discover.data ?? [], song)}
              >
                <Cover className="bg" src={song.cover} alt="" size={320} />
                <div className="veil" />
                <span className="play">
                  <Icon name="play" size={13} filled />
                </span>
                <div className="body">
                  <div className="reason">为你推荐</div>
                  <div className="t">{song.name}</div>
                  <div className="s">{song.artist}</div>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="section">
        <SectionHeader kicker="PLAYLISTS" title="精选歌单" />
        {playlists.loading ? (
          <SkeletonGrid count={2} />
        ) : playlists.error ? (
          <InlineError onRetry={playlists.reload} />
        ) : (
          <div className="grid-2">
            {(playlists.data ?? []).slice(0, 4).map((p) => (
              <PlaylistCard key={p.id} playlist={p} />
            ))}
          </div>
        )}
      </section>

      <section className="section">
        <SectionHeader kicker="CHARTS" title="排行榜" more="全部" onMore={() => navigate('/ranks')} />
        {ranks.loading ? (
          <div className="hscroll">
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton" style={{ width: 148, height: 132, borderRadius: 18 }} />
            ))}
          </div>
        ) : (
          <div className="hscroll">
            {(ranks.data ?? []).slice(0, 8).map((r) => (
              <RankCard key={r.id} rank={r} />
            ))}
          </div>
        )}
      </section>

      <section className="section">
        <SectionHeader
          kicker="NEW RELEASES"
          title="新歌速递"
          more="更多"
          onMore={() => navigate('/list/newsong')}
        />
        {newSongs.loading ? (
          <div className="hscroll">
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton" style={{ width: 118, height: 150, borderRadius: 16 }} />
            ))}
          </div>
        ) : (
          <div className="hscroll">
            {(newSongs.data ?? []).slice(0, 10).map((song) => (
              <SongCard
                key={song.hash}
                song={song}
                onPlay={() => playOne(newSongs.data ?? [], song)}
              />
            ))}
          </div>
        )}
      </section>

      <div style={{ height: 8 }} />
    </div>
  );
}

function QuickButton({
  icon,
  tone,
  label,
  onClick,
}: {
  icon: Parameters<typeof Icon>[0]['name'];
  tone: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button className="quick" onClick={onClick}>
      <span className={`ic ${tone}`}>
        <Icon name={icon} size={21} />
      </span>
      <span>{label}</span>
    </button>
  );
}

export function InlineError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="inline-error">
      加载失败
      <button onClick={onRetry}>重试</button>
    </div>
  );
}
