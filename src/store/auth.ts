import { create } from 'zustand';
import { readStore, removeStore, writeStore } from '../lib/storage';
import { setClientAuth } from '../api/client';
import { getUserDetail } from '../api';
import { clearRequestCache } from '../hooks/useRequest';
import type { AuthState } from '../api/types';

const KEY = 'mpp.auth.v1';

interface AuthStore {
  auth: AuthState | null;
  profileLoading: boolean;
  init: () => void;
  signIn: (token: string, userid: string) => Promise<void>;
  signOut: () => void;
  refreshProfile: () => Promise<void>;
}

const initial = readStore<AuthState | null>(KEY, null);

// 模块加载即注入登录态
if (initial) setClientAuth({ token: initial.token, userid: initial.userid });

export const useAuth = create<AuthStore>((set, get) => ({
  auth: initial,
  profileLoading: false,
  init: () => {
    const a = get().auth;
    if (a) {
      setClientAuth({ token: a.token, userid: a.userid });
      // 后台静默刷新资料
      void get().refreshProfile();
    }
  },
  signIn: async (token, userid) => {
    clearRequestCache();
    const next: AuthState = { token, userid, profile: { userid, nickname: '酷狗用户', isVip: false } };
    writeStore(KEY, next);
    setClientAuth({ token, userid });
    set({ auth: next });
    await get().refreshProfile();
  },
  signOut: () => {
    clearRequestCache();
    removeStore(KEY);
    setClientAuth(null);
    set({ auth: null });
  },
  refreshProfile: async () => {
    const auth = get().auth;
    if (!auth) return;
    set({ profileLoading: true });
    try {
      const profile = await getUserDetail();
      if (profile) {
        const next = { ...auth, profile: { ...profile, userid: profile.userid || auth.userid } };
        writeStore(KEY, next);
        set({ auth: next });
      }
    } catch {
      /* 忽略静默刷新失败 */
    } finally {
      set({ profileLoading: false });
    }
  },
}));
