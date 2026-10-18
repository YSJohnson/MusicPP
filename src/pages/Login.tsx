import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { checkQrSession, createQrSession, loginWithCode, sendLoginCode } from '../api';
import { Icon } from '../components/Icon';
import { cn } from '../lib/cn';
import { useAuth } from '../store/auth';
import { useSettings } from '../store/settings';
import { useToast } from '../store/toast';

type Phase = 'loading' | 'waiting' | 'scanned' | 'expired' | 'success' | 'error';
type Mode = 'qr' | 'sms';

const PHONE_RE = /^1[3-9]\d{9}$/;

export function LoginPage() {
  const navigate = useNavigate();
  const signIn = useAuth((s) => s.signIn);
  const toast = useToast((s) => s.show);
  const apiBase = useSettings((s) => s.apiBase);

  const [mode, setMode] = useState<Mode>('qr');

  /* --------------------------------- 扫码登录 -------------------------------- */

  const [qr, setQr] = useState<string>('');
  const [phase, setPhase] = useState<Phase>('loading');
  const [message, setMessage] = useState('');
  const keyRef = useRef('');
  const timerRef = useRef<number | null>(null);
  const stoppedRef = useRef(false);

  const stopPolling = () => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const poll = useCallback(async () => {
    if (!keyRef.current || stoppedRef.current) return;
    try {
      const res = await checkQrSession(keyRef.current);
      if (res.status === 4 && res.token && res.userid) {
        stopPolling();
        setPhase('success');
        setMessage('登录成功，正在同步你的歌单…');
        await signIn(res.token, res.userid);
        toast('欢迎回来 👋', 'success');
        window.setTimeout(() => {
          if (window.history.length > 1) navigate(-1);
          else navigate('/mine');
        }, 600);
        return;
      }
      if (res.status === 2) {
        setPhase('scanned');
        setMessage('已扫码，请在手机上确认登录');
        return;
      }
      if (res.status === 0) {
        stopPolling();
        setPhase('expired');
        setMessage('二维码已过期');
        return;
      }
      setPhase('waiting');
      setMessage('请使用酷狗音乐 App 扫描二维码');
    } catch (err) {
      if (err instanceof Error && /过期|expired/i.test(err.message)) {
        stopPolling();
        setPhase('expired');
        setMessage('二维码已过期');
      }
    }
  }, [navigate, signIn, toast]);

  const refresh = useCallback(async () => {
    stopPolling();
    stoppedRef.current = false;
    setPhase('loading');
    setMessage('正在获取二维码…');
    try {
      const session = await createQrSession();
      keyRef.current = session.key;
      setQr(session.image);
      setPhase('waiting');
      setMessage('请使用酷狗音乐 App 扫描二维码');
      timerRef.current = window.setInterval(() => void poll(), 2500);
    } catch (err) {
      setPhase('error');
      setMessage(err instanceof Error ? err.message : '无法生成二维码');
    }
  }, [poll]);

  useEffect(() => {
    void refresh();
    return () => {
      stoppedRef.current = true;
      stopPolling();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 切到验证码登录时暂停二维码轮询，切回来再恢复
  useEffect(() => {
    if (mode !== 'qr') {
      stopPolling();
      return;
    }
    if (!timerRef.current && keyRef.current && !stoppedRef.current && phase !== 'success') {
      timerRef.current = window.setInterval(() => void poll(), 2500);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, poll]);

  /* -------------------------------- 验证码登录 ------------------------------- */

  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [sending, setSending] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);
  const [smsTip, setSmsTip] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = window.setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => window.clearTimeout(t);
  }, [countdown]);

  const handleSendCode = async () => {
    if (!PHONE_RE.test(phone)) {
      setSmsTip({ ok: false, text: '请输入正确的 11 位手机号' });
      return;
    }
    setSending(true);
    setSmsTip(null);
    try {
      await sendLoginCode(phone);
      setCountdown(60);
      setSmsTip({ ok: true, text: '验证码已发送，请注意查收短信' });
    } catch (err) {
      setSmsTip({ ok: false, text: err instanceof Error ? err.message : '验证码发送失败' });
    } finally {
      setSending(false);
    }
  };

  const handleSmsLogin = async () => {
    if (!PHONE_RE.test(phone)) {
      setSmsTip({ ok: false, text: '请输入正确的 11 位手机号' });
      return;
    }
    if (!/^\d{4,6}$/.test(code)) {
      setSmsTip({ ok: false, text: '请输入短信验证码' });
      return;
    }
    setLoggingIn(true);
    setSmsTip(null);
    try {
      const res = await loginWithCode(phone, code);
      await signIn(res.token, res.userid);
      toast('登录成功 👋', 'success');
      window.setTimeout(() => {
        if (window.history.length > 1) navigate(-1);
        else navigate('/mine');
      }, 500);
    } catch (err) {
      setSmsTip({ ok: false, text: err instanceof Error ? err.message : '登录失败，请重试' });
    } finally {
      setLoggingIn(false);
    }
  };

  const statusTone =
    phase === 'success' ? 'ok' : phase === 'expired' || phase === 'error' ? 'warn' : '';

  return (
    <div className="page">
      <div className="auth-wrap">
        <header className="detail-head" style={{ paddingLeft: 0, paddingRight: 0 }}>
          <button className="icon-btn" onClick={() => navigate(-1)} aria-label="返回">
            <Icon name="chevronLeft" size={20} />
          </button>
          <div className="title">登录</div>
        </header>

        <div className="auth-tabs">
          <button
            className={cn('auth-tab', mode === 'qr' && 'active')}
            onClick={() => setMode('qr')}
          >
            <Icon name="qr" size={15} />
            扫码登录
          </button>
          <button
            className={cn('auth-tab', mode === 'sms' && 'active')}
            onClick={() => setMode('sms')}
          >
            <Icon name="edit" size={15} />
            验证码登录
          </button>
        </div>

        {mode === 'qr' ? (
          <div className="auth-body fade-enter">
            <div className="auth-title">
              <h1>登录酷狗概念版</h1>
              <p>
                使用手机上的酷狗音乐 App 扫码
                <br />
                登录后即可播放、同步歌单与会员权益
              </p>
            </div>

            {qr ? (
              <div
                className={cn(
                  'qr-card',
                  phase === 'expired' && 'expired',
                  phase === 'success' && 'success',
                )}
                data-label={
                  phase === 'expired' ? '已过期，点击刷新' : phase === 'success' ? '登录成功' : ''
                }
                onClick={() => {
                  if (phase === 'expired') void refresh();
                }}
              >
                <img src={qr} alt="登录二维码" />
                {phase === 'waiting' && <div className="qr-scanline" />}
              </div>
            ) : (
              <div
                className="skeleton"
                style={{ width: 246, height: 246, borderRadius: 26, alignSelf: 'center' }}
              />
            )}

            <div className={cn('auth-status', statusTone)}>{message || ' '}</div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button
                className="btn btn-ghost"
                onClick={() => void refresh()}
                disabled={phase === 'loading'}
              >
                <Icon
                  name="refresh"
                  size={16}
                  className={phase === 'loading' ? 'spin' : undefined}
                />
                刷新二维码
              </button>
            </div>

            {phase === 'error' && (
              <p className="dim" style={{ textAlign: 'center', fontSize: 11.5, lineHeight: 1.7 }}>
                当前连接方式：{apiBase || '直连模式'}
                <br />
                请检查网络后重试
              </p>
            )}

            <div className="auth-steps">
              <div className="auth-step">
                <b>1</b> 打开手机酷狗音乐 App（概念版）
              </div>
              <div className="auth-step">
                <b>2</b> 点击「扫一扫」扫描上方二维码
              </div>
              <div className="auth-step">
                <b>3</b> 在手机上确认登录，即刻同步
              </div>
            </div>
          </div>
        ) : (
          <div className="auth-body fade-enter">
            <div className="auth-title">
              <h1>手机号登录</h1>
              <p>
                使用已绑定酷狗账号的手机号
                <br />
                登录后自动同步歌单与会员权益
              </p>
            </div>

            <div className="sms-form">
              <label className="sms-label">手机号</label>
              <div className="field sms-phone">
                <span className="phone-prefix">+86</span>
                <input
                  value={phone}
                  placeholder="请输入手机号"
                  inputMode="tel"
                  maxLength={11}
                  autoComplete="tel"
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
                />
              </div>

              <label className="sms-label" style={{ marginTop: 16 }}>
                验证码
              </label>
              <div className="field">
                <input
                  value={code}
                  placeholder="短信验证码"
                  inputMode="numeric"
                  maxLength={6}
                  autoComplete="one-time-code"
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void handleSmsLogin();
                  }}
                />
                <button
                  className="sms-send"
                  disabled={sending || countdown > 0 || !PHONE_RE.test(phone)}
                  onClick={() => void handleSendCode()}
                >
                  {countdown > 0 ? `${countdown}s` : sending ? '发送中' : '获取验证码'}
                </button>
              </div>

              <div className={cn('sms-tip', smsTip && (smsTip.ok ? 'ok' : 'err'))}>
                {smsTip?.text ?? '验证码 5 分钟内有效，请勿泄露给他人'}
              </div>

              <button
                className="btn btn-primary btn-block"
                style={{ marginTop: 18 }}
                disabled={loggingIn}
                onClick={() => void handleSmsLogin()}
              >
                {loggingIn ? '登录中…' : '登录'}
              </button>

              <button
                className="btn btn-ghost btn-block"
                style={{ marginTop: 10 }}
                onClick={() => setMode('qr')}
              >
                改用扫码登录
              </button>
            </div>

            <div className="auth-steps">
              <div className="auth-step">
                <b>1</b> 输入注册酷狗的手机号
              </div>
              <div className="auth-step">
                <b>2</b> 获取并填写短信验证码
              </div>
              <div className="auth-step">
                <b>3</b> 登录成功，自动同步账号
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
