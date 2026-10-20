import { useEffect, useRef } from 'react';
import { getPlaybackTime, usePlayer } from '../store/player';

/** 只在前台播放时逐帧更新局部 DOM，暂停、缓冲、跳转时立即同步一次。 */
export function usePlaybackFrame(onFrame: (time: number) => void, enabled = true) {
  const callbackRef = useRef(onFrame);
  callbackRef.current = onFrame;

  useEffect(() => {
    if (!enabled) return;
    let frame = 0;
    const shouldAnimate = () => {
      const { playing, loading, buffering } = usePlayer.getState();
      return playing && !loading && !buffering && !document.hidden;
    };
    const paint = () => callbackRef.current(getPlaybackTime());
    const tick = () => {
      frame = 0;
      paint();
      if (shouldAnimate()) frame = requestAnimationFrame(tick);
    };
    const sync = () => {
      paint();
      if (shouldAnimate()) {
        if (!frame) frame = requestAnimationFrame(tick);
      } else {
        cancelAnimationFrame(frame);
        frame = 0;
      }
    };
    const unsubscribe = usePlayer.subscribe((state, prev) => {
      if (
        state.time !== prev.time || state.playing !== prev.playing ||
        state.loading !== prev.loading || state.buffering !== prev.buffering ||
        state.duration !== prev.duration || state.queue !== prev.queue || state.index !== prev.index
      ) sync();
    });
    document.addEventListener('visibilitychange', sync);
    sync();
    return () => {
      unsubscribe();
      document.removeEventListener('visibilitychange', sync);
      cancelAnimationFrame(frame);
    };
  }, [enabled]);
}
