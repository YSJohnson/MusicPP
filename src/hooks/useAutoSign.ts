import { useEffect, useRef } from 'react';
import { signToday, upgradeVipToday } from '../api';
import { setClientAuth } from '../api/client';
import { useAuth } from '../store/auth';
import { useSettings } from '../store/settings';
import { useToast } from '../store/toast';

/** 本地日期（YYYY-MM-DD） */
export function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * 每天第一次打开 App（且已登录）时自动完成两件事：
 * 1. 签到 —— 领取畅听 VIP 时长
 * 2. 领取 VIP —— 升级 1 天概念版 VIP
 * 失败不会标记日期，下次启动会重试（风控除外，当天不再重试）。
 */
export function useAutoSign() {
  const auth = useAuth((s) => s.auth);
  const token = auth?.token;
  const autoSign = useSettings((s) => s.autoSign);
  const lastSignDate = useSettings((s) => s.lastSignDate);
  const lastUpgradeDate = useSettings((s) => s.lastUpgradeDate);
  const inFlight = useRef(false);

  useEffect(() => {
    if (!token || !autoSign) return;
    const today = todayKey();
    if (lastSignDate === today && lastUpgradeDate === today) return;
    if (inFlight.current) return;

    // 保证直连请求能拿到 token（避免早于 auth.init 执行）
    setClientAuth({ token, userid: auth?.userid });

    inFlight.current = true;
    void (async () => {
      const toast = useToast.getState().show;
      const settings = useSettings.getState();
      try {
        if (lastSignDate !== today) {
          const sign = await signToday();
          settings.setSignResult(
            sign.status === 'failed' ? '' : today,
            sign.status,
            sign.message,
          );

          if (sign.status === 'success') {
            toast('每日签到成功，已领取 VIP 时长', 'success');
          } else if (sign.status === 'already') {
            toast('今天已经签过到了', 'info');
          } else if (sign.status === 'blocked') {
            toast('账号存在风控，请前往手机酷狗领取', 'warn');
          } else {
            toast(`签到失败：${sign.message}`, 'error');
          }

          // 签到异常（风控 / 失败）时不继续领 VIP
          if (sign.status === 'failed' || sign.status === 'blocked') return;
        }

        if (lastUpgradeDate !== today) {
          const vip = await upgradeVipToday();
          settings.setUpgradeResult(vip.status === 'failed' ? '' : today, vip.status, vip.message);

          if (vip.status === 'success') {
            toast('领取成功，获得 1 天概念版 VIP', 'success');
          } else if (vip.status === 'already') {
            toast('今天的 VIP 已经领过了', 'info');
          } else if (vip.status === 'blocked') {
            toast('账号存在风控，请前往手机酷狗领取', 'warn');
          } else {
            toast(`领取 VIP 失败：${vip.message}`, 'error');
          }
        }

        void useAuth.getState().refreshProfile();
      } finally {
        inFlight.current = false;
      }
    })();
  }, [token, autoSign, lastSignDate, lastUpgradeDate, auth?.userid]);
}
