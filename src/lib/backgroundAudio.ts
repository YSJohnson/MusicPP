import { Capacitor, registerPlugin } from '@capacitor/core';

interface BackgroundAudioNative {
  start(): Promise<void>;
  stop(): Promise<void>;
}

const native = registerPlugin<BackgroundAudioNative>('BackgroundAudio');

/** 前台服务是否在运行（JS 侧视角） */
let running = false;
let releaseTimer: number | null = null;

/**
 * 「一首歌放完 → 下一首开始」之间必然有一段 pause/ended 空档（解析地址可能耗时几百毫秒到数秒）。
 * 如果在这段空档里就把前台服务停掉：
 * - 唤醒锁被释放，进程变成 cached 进程，可能被系统冻结（切歌直接卡死）；
 * - Android 12+ 在后台再也无法重新 startForegroundService（ForegroundServiceStartNotAllowedException），
 *   服务一旦停掉就回不来了。
 * 所以暂停时先保留服务一段时间，等真正切歌失败/用户暂停再停。
 */
export const BACKGROUND_RELEASE_GRACE_MS = 30_000;

function cancelPendingRelease() {
  if (releaseTimer !== null) {
    window.clearTimeout(releaseTimer);
    releaseTimer = null;
  }
}

function stopNow() {
  cancelPendingRelease();
  if (!running) return;
  running = false;
  if (!Capacitor.isNativePlatform()) return;
  void native.stop().catch(() => {
    /* 插件不可用时静默降级 */
  });
}

function startNow() {
  if (!Capacitor.isNativePlatform()) return;
  cancelPendingRelease();
  if (running) return;
  running = true;
  void native.start().catch(() => {
    // 例如 Android 12+ 在后台启动前台服务被拒：这里降级，等回到前台再重新申请
    running = false;
  });
}

/** 开始（或继续）播放：立刻拉起前台服务，并取消待执行的停止 */
export function acquireBackgroundAudio() {
  startNow();
}

/** 暂停/切歌空档：延迟停止前台服务，给「下一首」留出启动时间 */
export function releaseBackgroundAudioSoon(delayMs = BACKGROUND_RELEASE_GRACE_MS) {
  if (!Capacitor.isNativePlatform()) return;
  if (!running) return;
  cancelPendingRelease();
  releaseTimer = window.setTimeout(() => {
    releaseTimer = null;
    stopNow();
  }, Math.max(0, delayMs));
}

/** 明确不再播放（用户暂停 / 停止 / 清空列表）：立即停止前台服务 */
export function releaseBackgroundAudioNow() {
  stopNow();
}

/** 兼容旧调用：播放 -> 申请；暂停 -> 延迟释放 */
export function setBackgroundAudio(playing: boolean) {
  if (playing) acquireBackgroundAudio();
  else releaseBackgroundAudioSoon();
}
