import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { useLocation, useNavigate } from 'react-router-dom';
import { closePlayer } from '../lib/playerTransition';

/**
 * 原生壳适配：
 * - Android 实体返回键：优先回退路由，根页面再退出应用
 * - 切后台不暂停：由原生前台服务（BackgroundAudio）保证后台播放
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


}
