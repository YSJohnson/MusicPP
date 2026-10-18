import type { NavigateFunction } from 'react-router-dom';

let closing = false;

/**
 * 关闭播放器：先播放向下滑出的动画，再真正退出路由。
 * 覆盖层在 App 中以 /player 路径渲染，返回后底层页面保持不变。
 */
export function closePlayer(navigate: NavigateFunction) {
  if (closing) return;

  const el = document.querySelector<HTMLElement>('.player');
  if (!el) {
    navigate(-1);
    return;
  }

  closing = true;
  el.classList.add('closing');

  let done = false;
  let timer = 0;

  const finish = () => {
    if (done) return;
    done = true;
    closing = false;
    el.removeEventListener('animationend', onEnd);
    window.clearTimeout(timer);
    navigate(-1);
  };

  // 只认播放器自身滑出的动画，忽略内部子元素的动画
  const onEnd = (e: AnimationEvent) => {
    if (e.target !== el || e.animationName !== 'player-out') return;
    finish();
  };

  el.addEventListener('animationend', onEnd);
  timer = window.setTimeout(finish, 460);
}
