import { Capacitor, registerPlugin } from '@capacitor/core';

interface BackgroundAudioNative {
  start(): Promise<void>;
  stop(): Promise<void>;
}

const native = registerPlugin<BackgroundAudioNative>('BackgroundAudio');

let active = false;

/** 播放时启动前台服务（保活 + 唤醒锁），暂停时停止 */
export function setBackgroundAudio(playing: boolean) {
  if (!Capacitor.isNativePlatform()) return;
  if (playing === active) return;
  active = playing;
  const task = playing ? native.start() : native.stop();
  void task.catch(() => {
    // 插件不可用时静默降级：仍然可以前台播放
    active = false;
  });
}
