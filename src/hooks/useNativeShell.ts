import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { useLocation, useNavigate } from 'react-router-dom';
import { closePlayer } from '../lib/playerTransition';
import { resumePlaybackIfNeeded } from '../store/player';

/**
 * 原生壳适配：
 * - Android 实体返回键：优先回退路由，根页面再退出应用
 * - 切后台不暂停：由原生前台服务（BackgroundAudio）保证后台播放
 * - 回到前台：后台切歌若被系统打断，自动续上
 */
export function useNativeShell() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const sub = CapacitorApp.addListener('backButton', () => {
      const path = location.pathname;
      if (path === '/player') {
        closePlayer(navigate);
        return;
      }
      if (path === '/' || path === '/mine') {
        void CapacitorApp.exitApp();
        return;
      }
      navigate(-1);
    });
    return () => {
      void sub.then((handle) => handle.remove());
    };
  }, [location.pathname, navigate]);

  // App 从后台回到前台：检查播放是否在后台被打断（进程冻结 / 切歌失败），自动续上
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const sub = CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      if (isActive) void resumePlaybackIfNeeded();
    });
    return () => {
      void sub.then((handle) => handle.remove());
    };
  }, []);
}
