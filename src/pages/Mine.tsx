import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUserPlaylists, signToday, upgradeVipToday } from '../api';
import { todayKey } from '../hooks/useAutoSign';
import { useRequest } from '../hooks/useRequest';
import { fmtCount } from '../lib/format';
import { useAuth } from '../store/auth';
import { usePlayer } from '../store/player';
import { useSettings } from '../store/settings';
import { useToast } from '../store/toast';
import { Cover } from '../components/Cover';
import { EmptyState, SkeletonGrid } from '../components/EmptyState';
import { Icon } from '../components/Icon';
import type { IconName } from '../components/Icon';
import { SectionHeader } from '../components/SectionHeader';
import { InlineError } from './Home';
import conceptBadge from '../assets/vip-concept.png';
import listenBadge from '../assets/vip-listen.png';

export function MinePage() {
  const navigate = useNavigate();
  const auth = useAuth((s) => s.auth);
  const signOut = useAuth((s) => s.signOut);
  const profile = auth?.profile;
  const lastPlayed = useSettings((s) => s.lastPlayed);
  const toast = useToast((s) => s.show);
  const playQueue = usePlayer((s) => s.playQueue);
  const lastSignDate = useSettings((s) => s.lastSignDate);
  const lastUpgradeDate = useSettings((s) => s.lastUpgradeDate);
  const [signing, setSigning] = useState(false);
  const [upgrading, setUpgrading] = useState(false);

  const signedToday = lastSignDate === todayKey();
  const upgradedToday = lastUpgradeDate === todayKey();

  const handleSign = async () => {
    if (!auth) {
      navigate('/login');
      return;
    }
    if (signedToday) {
      toast('今天已经签到过了', 'info');
      return;
    }
    setSigning(true);
    try {
      const res = await signToday();
      useSettings
        .getState()
        .setSignResult(res.status === 'failed' ? '' : todayKey(), res.status, res.message);
      toast(res.message, res.status === 'failed' ? 'error' : 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : '签到失败', 'error');
    } finally {
      setSigning(false);
    }
  };

  const handleUpgrade = async () => {
    if (!auth) {
      navigate('/login');
      return;
    }
    if (upgradedToday) {
      toast('今天已经领过 VIP 了', 'info');
      return;
    }
    setUpgrading(true);
    try {
      const res = await upgradeVipToday();
      useSettings
        .getState()
        .setUpgradeResult(res.status === 'failed' ? '' : todayKey(), res.status, res.message);
      toast(res.message, res.status === 'failed' ? 'error' : 'success');
      if (res.status === 'success') void useAuth.getState().refreshProfile();
    } catch (err) {
      toast(err instanceof Error ? err.message : '领取失败', 'error');
    } finally {
      setUpgrading(false);
    }
  };

  const playlists = useRequest(getUserPlaylists, [!!auth], { enabled: !!auth });


  return (
    <div className="page">
      <header className="hero-head">
        <div className="greet">收藏、歌单与最近播放</div>
        <div className="brand">
          <h1>我的</h1>
        </div>
      </header>

      {auth ? (
        <div className="profile-hero">
          <div className="row">
            <Cover className="avatar" src={profile?.avatar} alt="头像" size={200} iconSize={22} />
            <div className="who">
              <div className="nick">
                <span className="ellipsis">{profile?.nickname ?? '酷狗用户'}</span>
                {profile?.conceptVip && (
                  <img
                    className="vip-badge-img"
                    src={conceptBadge}
                    alt="概念VIP"
                    title={profile.conceptVipExpire ? `概念 VIP 到期：${profile.conceptVipExpire}` : '概念 VIP'}
                  />
                )}
                {profile?.listenVip && (
                  <img
                    className="vip-badge-img"
                    src={listenBadge}
                    alt="畅听VIP"
                    title={profile.listenVipExpire ? `畅听 VIP 到期：${profile.listenVipExpire}` : '畅听 VIP'}
                  />
                )}
                {!profile?.listenVip && !profile?.conceptVip && profile?.isVip && (
                  <span className="vip-pill">VIP</span>
                )}
              </div>
              <div className="tagline">
                {profile?.conceptVipExpire
                  ? `概念 VIP 至 ${profile.conceptVipExpire}`
                  : profile?.listenVipExpire
                    ? `畅听 VIP 至 ${profile.listenVipExpire}`
                    : '已连接酷狗概念版账号'}
              </div>
            </div>
            <button
              className="icon-btn"
              aria-label="退出登录"
              onClick={() => {
                signOut();
                toast('已退出登录', 'info');
              }}
            >
              <Icon name="logout" size={18} />
            </button>
          </div>
          <div className="stats">
            {typeof profile?.listenCount === 'number' && (
              <div className="stat">
                <b>{fmtCount(profile.listenCount)}</b>
                <span>累计收听</span>
              </div>
            )}
            {typeof profile?.fans === 'number' && (
              <div className="stat">
                <b>{fmtCount(profile.fans)}</b>
                <span>粉丝</span>
              </div>
            )}
            <div className="stat">
              <b>{playlists.data?.length ?? '—'}</b>
              <span>歌单</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="profile-hero">
          <div className="row">
            <div className="avatar placeholder">
              <Icon name="user" size={24} />
            </div>
            <div className="who">
              <div className="nick">未登录</div>
              <div className="tagline">登录后可同步歌单、收藏与会员权益</div>
            </div>
          </div>
          <button
            className="btn btn-primary btn-block"
            style={{ marginTop: 18 }}
            onClick={() => navigate('/login')}
          >
            <Icon name="qr" size={17} />
            扫码登录
          </button>
        </div>
      )}

      {lastPlayed && (
        <section className="section">
          <SectionHeader kicker="RECENT" title="继续播放" />
          <div className="hscroll">
            {lastPlayed.queue.slice(0, 12).map((song, i) => (
              <button
                key={`${song.hash}-${i}`}
                className="song-card tap"
                onClick={() => void playQueue(lastPlayed.queue, i, '继续播放')}
              >
                <div className="art">
                  <Cover src={song.cover} alt={song.name} size={280} />
                </div>
                <div className="name">{song.name}</div>
                <div className="sub">{song.artist}</div>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="section">
        <SectionHeader
          kicker="MY PLAYLISTS"
          title="我的歌单"
          more={auth ? '刷新' : undefined}
          onMore={auth ? playlists.reload : undefined}
        />
        {!auth ? (
          <EmptyState
            icon="folder"
            text="登录后即可查看你在酷狗收藏和创建的歌单"
            action={
              <button className="btn btn-ghost" onClick={() => navigate('/login')}>
                去登录
              </button>
            }
          />
        ) : playlists.loading ? (
          <SkeletonGrid count={2} />
        ) : playlists.error ? (
          <InlineError onRetry={playlists.reload} />
        ) : !playlists.data?.length ? (
          <EmptyState icon="folder" text="还没有歌单，先去主页逛逛吧" />
        ) : (
          <div className="grid-2">
            {(playlists.data ?? []).map((p) => (
              <button
                key={p.id}
                className="pl-card tap"
                onClick={() => navigate(`/playlist/${encodeURIComponent(p.id)}`)}
              >
                <div className="art">
                  <Cover src={p.cover} alt={p.name} size={300} />
                </div>
                <div className="name">{p.name}</div>
                <div className="sub">
                  {typeof p.count === 'number' ? `${p.count} 首` : p.creator || '歌单'}
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      <div className="menu-list">
        <MenuItem
          icon="calendar"
          label="每日签到"
          value={!auth ? '登录后自动签到' : signing ? '签到中…' : signedToday ? '今日已签到' : '待签到'}
          onClick={() => void handleSign()}
        />
        <MenuItem
          icon="sparkle"
          label="领取 1 天 VIP"
          value={!auth ? '登录后自动领取' : upgrading ? '领取中…' : upgradedToday ? '今日已领取' : '待领取'}
          onClick={() => void handleUpgrade()}
        />


        {!auth && (
          <MenuItem icon="qr" label="扫码登录" value="同步账号" onClick={() => navigate('/login')} />
        )}
        <MenuItem
          icon="sparkle"
          label="关于 Music++"
          value="v0.5.8"
          onClick={() => navigate('/settings')}
        />
      </div>

      <div className="about-foot">
        Music++ · 酷狗概念版第三方客户端
        <br />
        直连酷狗接口 · 无需自建服务
      </div>
    </div>
  );
}

function MenuItem({
  icon,
  label,
  value,
  onClick,
}: {
  icon: IconName;
  label: string;
  value?: string;
  onClick?: () => void;
}) {
  return (
    <button className="menu-item" onClick={onClick}>
      <span className="ic">
        <Icon name={icon} size={17} />
      </span>
      <span className="label">{label}</span>
      {value && <span className="value">{value}</span>}
      <Icon name="chevronRight" size={15} className="chev dim" />
    </button>
  );
}
