import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { closePlayer } from '../lib/playerTransition';
import { getSongQualities } from '../api';
import { qualityLabel } from '../api/normalize';
import type { QualityInfo } from '../api/types';
import { Cover } from '../components/Cover';
import { Icon } from '../components/Icon';
import type { IconName } from '../components/Icon';
import { LyricView } from '../components/LyricView';
import { ProgressBar } from '../components/ProgressBar';
import { Sheet } from '../components/Sheet';
import { cn } from '../lib/cn';
import { fmtTime } from '../lib/format';
import { useAuth } from '../store/auth';
import { MODE_META, usePlayer } from '../store/player';
import { useSongMenu } from '../store/songMenu';
import { useSettings } from '../store/settings';

export function PlayerPage() {
  const navigate = useNavigate();
  const queue = usePlayer((s) => s.queue);
  const index = usePlayer((s) => s.index);
  const playing = usePlayer((s) => s.playing);
  const loading = usePlayer((s) => s.loading);
  const buffering = usePlayer((s) => s.buffering);
  const time = usePlayer((s) => s.time);
  const duration = usePlayer((s) => s.duration);
  const lyric = usePlayer((s) => s.lyric);
  const lyricLoading = usePlayer((s) => s.lyricLoading);
  const lyricHash = usePlayer((s) => s.lyricHash);
  const loadLyric = usePlayer((s) => s.loadLyric);
  const mode = usePlayer((s) => s.mode);
  const error = usePlayer((s) => s.error);
  const context = usePlayer((s) => s.context);
  const resolvedQuality = usePlayer((s) => s.resolvedQuality);
  const preferredQuality = usePlayer((s) => s.quality);
  const toggle = usePlayer((s) => s.toggle);
  const next = usePlayer((s) => s.next);
  const prev = usePlayer((s) => s.prev);
  const seek = usePlayer((s) => s.seek);
  const cycleMode = usePlayer((s) => s.cycleMode);
  const playAt = usePlayer((s) => s.playAt);
  const removeAt = usePlayer((s) => s.removeAt);
  const clearQueue = usePlayer((s) => s.clearQueue);
  const setQuality = usePlayer((s) => s.setQuality);
  const openMenu = useSongMenu((s) => s.open);
  const authed = useAuth((s) => !!s.auth);
  const lyricAlign = useSettings((s) => s.lyricAlign);

  const [showLyric, setShowLyric] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);
  const [qualityOpen, setQualityOpen] = useState(false);
  const [qualities, setQualities] = useState<QualityInfo[]>([]);
  const song = queue[index];

  useEffect(() => {
    let alive = true;
    if (!song) {
      setQualities([]);
      return;
    }
    void getSongQualities(song).then((list) => {
      if (alive) setQualities(list);
    });
    return () => {
      alive = false;
    };
  }, [song?.hash]);

  // 打开播放器即加载歌词（不必先按播放）
  useEffect(() => {
    if (!song) return;
    if (lyricHash === song.hash || lyricLoading) return;
    void loadLyric();
  }, [song?.hash, lyricHash, lyricLoading, loadLyric]);

  if (!song) {
    return (
      <div className="player">
        <div className="player-bg" />
        <div className="player-veil" />
        <div className="player-inner">
          <header className="player-head">
            <button className="icon-btn" onClick={() => closePlayer(navigate)} aria-label="返回">
              <Icon name="chevronDown" size={20} />
            </button>
            <div className="kicker">Music++</div>
            <span style={{ width: 36 }} />
          </header>
          <div className="player-stage">
            <div className="art-shell placeholder">
              <Icon name="music" size={44} />
            </div>
          </div>
          <div style={{ textAlign: 'center', paddingBottom: 40 }}>
            <div className="h2">还没有正在播放的歌曲</div>
            <p className="dim" style={{ fontSize: 12, marginTop: 8 }}>
              去搜索或从每日推荐里挑一首吧
            </p>
            <button
              className="btn btn-primary"
              style={{ marginTop: 18 }}
              onClick={() => navigate('/search')}
            >
              搜索音乐
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('player', playing && 'playing')}>
      <div
        className="player-bg"
        style={song.cover ? { backgroundImage: `url("${song.cover}")` } : undefined}
      />
      <div className="player-veil" />

      <div className="player-inner">
        <header className="player-head">
          <button className="icon-btn" onClick={() => closePlayer(navigate)} aria-label="收起">
            <Icon name="chevronDown" size={20} />
          </button>
          <div className="kicker">
            {context || '正在播放'} · <b>Music++</b>
          </div>
          <span style={{ width: 34 }} />
        </header>

        <div
          className="player-stage"
          onClick={() => setShowLyric((v) => !v)}
          role="button"
          tabIndex={0}
        >
          {showLyric ? (
            <LyricView
              lyric={lyric}
              loading={lyricLoading}
              time={time}
              align={lyricAlign}
              onSeek={(t) => seek(t)}
            />
          ) : (
            <div className="art-shell">
              <Cover src={song.cover} alt={song.name} size={700} iconSize={48} />
              <span className="ring" />
              {buffering && (
                <div className="art-buffer">
                  <Icon name="disc" size={20} className="spin" />
                </div>
              )}
            </div>
          )}

        </div>

        {error && (
          <div className="player-error">
            <Icon name="wifi" size={14} />
            <span>{error}</span>
            {!authed && (
              <button onClick={() => navigate('/login')}>去登录</button>
            )}
          </div>
        )}

        <div className="track-line">
          <div className="info">
            <h1>{song.name}</h1>
            <div className="artist">
              <span>{song.artist}</span>
              {song.album ? <span>{song.album}</span> : null}
              {song.vip && <span className="badge vip" style={{ marginLeft: 2 }}>VIP</span>}
            </div>
          </div>

        </div>

        <div className="player-tools-row">
          <button
            className="tool-pill"
            onClick={() => setQualityOpen(true)}
            aria-label="音质"
          >
            <Icon name="headphones" size={14} />
            {qualityLabel(resolvedQuality || preferredQuality)}
          </button>
          <button
            className={cn('tool', showLyric && 'on')}
            onClick={() => setShowLyric((v) => !v)}
            aria-label={showLyric ? '显示封面' : '显示歌词'}
          >
            <Icon name="music" size={20} />
          </button>
          <button
            className="tool"
            onClick={cycleMode}
            aria-label={MODE_META[mode].label}
          >
            <Icon name={MODE_META[mode].icon as IconName} size={20} />
          </button>
          <button className="tool" onClick={() => openMenu(song)} aria-label="更多">
            <Icon name="more" size={20} />
          </button>
        </div>

        <ProgressBar time={time} duration={duration} onSeek={seek} />

        <div className="controls">

          <button className="ctrl" onClick={() => void prev()} aria-label="上一首">
            <Icon name="prev" size={26} />
          </button>
          <button
            className="ctrl-main"
            onClick={() => void toggle()}
            aria-label={playing ? '暂停' : '播放'}
          >
            {loading ? (
              <Icon name="disc" size={26} className="spin" />
            ) : (
              <Icon name={playing ? 'pause' : 'play'} size={28} />
            )}
          </button>
          <button className="ctrl" onClick={() => void next()} aria-label="下一首">
            <Icon name="next" size={26} />
          </button>
          <button
            className="ctrl small"
            onClick={() => setQueueOpen(true)}
            aria-label="播放列表"
          >
            <Icon name="queue" size={21} />
          </button>
        </div>


      </div>

      <Sheet open={queueOpen} title={`播放列表 · ${queue.length}`} onClose={() => setQueueOpen(false)}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0 10px 8px' }}>
          <button
            className="util-btn"
            onClick={() => {
              clearQueue();
              setQueueOpen(false);
            }}
          >
            <Icon name="trash" size={13} />
            清空
          </button>
        </div>
        {queue.map((item, i) => (
          <div
            key={`${item.hash}-${i}`}
            className={cn('queue-row', i === index && 'active')}
            role="button"
            tabIndex={0}
            onClick={() => void playAt(i)}
          >
            <span className="idx">{i === index && playing ? '▮▮' : i + 1}</span>
            <div className="song-main">
              <div className="song-name">
                <span className="txt">{item.name}</span>
              </div>
              <div className="song-sub">
                <span className="ellipsis">{item.artist}</span>
              </div>
            </div>
            <button
              className="song-more"
              aria-label="移除"
              onClick={(e) => {
                e.stopPropagation();
                removeAt(i);
              }}
            >
              <Icon name="close" size={14} />
            </button>
          </div>
        ))}
      </Sheet>

      <Sheet open={qualityOpen} title="音质选择" onClose={() => setQualityOpen(false)}>
        {(qualities.length ? qualities : [
          { quality: '128', label: '标准', available: true, needVip: false },
          { quality: '320', label: '高品', available: true, needVip: false },
          { quality: 'flac', label: '无损', available: true, needVip: false },
        ]).map((q) => (
          <button
            key={q.quality}
            className={cn('quality-row', preferredQuality === q.quality && 'active')}
            onClick={() => {
              void setQuality(q.quality);
              setQualityOpen(false);
            }}
          >
            <span className="q">
              <span className="mark" />
              {q.label}
              <span className="tag">{q.quality}</span>
            </span>
            <span className={cn('tag', q.available && 'ok')}>
              {q.available ? '可播放' : q.needVip ? '需会员/自动降级' : '不可用'}
            </span>
          </button>
        ))}
        <p className="dim" style={{ fontSize: 11, padding: '10px 14px 4px', lineHeight: 1.6 }}>
          概念版会员可获取更高音质；若当前账号无权限，播放时会自动降级到可用音质。
        </p>
      </Sheet>
    </div>
  );
}
