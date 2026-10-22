import { useNavigate } from 'react-router-dom';
import { clearApiCache } from '../api/client';
import { qualityLabel } from '../api/normalize';
import { Icon } from '../components/Icon';
import { APP_VERSION } from '../lib/appInfo';
import { cn } from '../lib/cn';
import { useAuth } from '../store/auth';
import { useSettings } from '../store/settings';
import { useToast } from '../store/toast';

const QUALITIES = ['128', '320', 'flac', 'high'];

export function SettingsPage() {
  const navigate = useNavigate();
  const quality = useSettings((s) => s.quality);
  const setQuality = useSettings((s) => s.setQuality);
  const clearSearches = useSettings((s) => s.clearSearches);
  const autoSign = useSettings((s) => s.autoSign);
  const lyricAlign = useSettings((s) => s.lyricAlign);
  const setLyricAlign = useSettings((s) => s.setLyricAlign);
  const setAutoSign = useSettings((s) => s.setAutoSign);
  const auth = useAuth((s) => s.auth);
  const signOut = useAuth((s) => s.signOut);
  const toast = useToast((s) => s.show);


  return (
    <div className="page settings-page">
      <header className="detail-head">
        <button className="icon-btn" onClick={() => navigate(-1)} aria-label="返回">
          <Icon name="chevronLeft" size={20} />
        </button>
        <div className="title">设置</div>
      </header>

      <div className="page-inner">
        <div className="eyebrow" style={{ marginTop: 12 }}>
          AUDIO
        </div>
        <div className="chips" style={{ padding: 0, marginTop: 8 }}>
          {QUALITIES.map((q) => (
            <button
              key={q}
              className={cn('chip', quality === q && 'active')}
              onClick={() => {
                setQuality(q);
                toast(`音质已切换为 ${qualityLabel(q)}`, 'success');
              }}
            >
              {qualityLabel(q)}
              <span style={{ opacity: 0.55, fontSize: 11, marginLeft: 5 }}>{q}</span>
            </button>
          ))}
        </div>
        <p className="footnote" style={{ marginTop: 8, lineHeight: 1.5 }}>
          更高音质需要概念版会员，无权限时会使用可播放的最佳音质。
        </p>

        <div className="eyebrow" style={{ marginTop: 26 }}>
          LYRICS
        </div>
        <div className="chips" style={{ padding: 0, marginTop: 8 }}>
          {([
            { value: 'center', label: '居中排列' },
            { value: 'left', label: '靠左排列' },
          ] as const).map((opt) => (
            <button
              key={opt.value}
              className={cn('chip', lyricAlign === opt.value && 'active')}
              onClick={() => setLyricAlign(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="eyebrow" style={{ marginTop: 26 }}>
          ACCOUNT
        </div>
        <div className="menu-list">
          {auth ? (
            <>
              <div className="menu-item" style={{ pointerEvents: 'none' }}>
                <span className="ic">
                  <Icon name="user" size={19} />
                </span>
                <span className="label">{auth.profile?.nickname ?? '酷狗用户'}</span>
                <span className="value">{auth.profile?.isVip ? 'VIP' : '已登录'}</span>
              </div>
              <button className="menu-item" onClick={() => signOut()}>
                <span className="ic">
                  <Icon name="logout" size={19} />
                </span>
                <span className="label" style={{ color: 'var(--accent)' }}>
                  退出登录
                </span>
              </button>
            </>
          ) : (
            <button className="menu-item" onClick={() => navigate('/login')}>
              <span className="ic">
                <Icon name="qr" size={19} />
              </span>
              <span className="label">登录账号</span>
              <Icon name="chevronRight" size={16} className="dim" />
            </button>
          )}
          <button
            className="menu-item"
            onClick={() => {
              setAutoSign(!autoSign);
              toast(autoSign ? '已关闭每日自动签到' : '已开启每日自动签到', 'success');
            }}
          >
            <span className="ic">
              <Icon name="calendar" size={19} />
            </span>
            <span className="label">每日自动签到领 VIP</span>
            <span className="value">{autoSign ? '已开启' : '已关闭'}</span>
            {autoSign && <Icon name="check" size={16} style={{ color: 'var(--accent)' }} />}
          </button>
        </div>

        <div className="eyebrow" style={{ marginTop: 26 }}>
          STORAGE
        </div>
        <div className="menu-list">
          <button
            className="menu-item"
            onClick={() => {
              clearApiCache();
              toast('接口缓存已清除', 'success');
            }}
          >
            <span className="ic">
              <Icon name="refresh" size={19} />
            </span>
            <span className="label">清除接口缓存</span>
            <Icon name="chevronRight" size={16} className="dim" />
          </button>
          <button
            className="menu-item"
            onClick={() => {
              clearSearches();
              toast('搜索历史已清除', 'success');
            }}
          >
            <span className="ic">
              <Icon name="trash" size={19} />
            </span>
            <span className="label">清除搜索历史</span>
            <Icon name="chevronRight" size={16} className="dim" />
          </button>
        </div>

        <div className="eyebrow" style={{ marginTop: 26 }}>
          ABOUT
        </div>
        <p className="footnote" style={{ marginTop: 8, lineHeight: 1.6 }}>
          Music++ v{APP_VERSION} · 酷狗概念版第三方客户端
          <br />
          本项目仅供学习与技术交流。
        </p>
      </div>

      <div style={{ height: 40 }} />
    </div>
  );
}
