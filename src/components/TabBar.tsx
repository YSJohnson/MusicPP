import { useLocation, useNavigate } from 'react-router-dom';
import LiquidGlass from 'liquid-glass-react';
import { cn } from '../lib/cn';
import { Icon } from './Icon';
import type { IconName } from './Icon';
import { NowPlayingButton } from './NowPlayingButton';

const LEFT: { to: string; icon: IconName; label: string } = {
  to: '/',
  icon: 'home',
  label: '主页',
};

const RIGHT: { to: string; icon: IconName; label: string } = {
  to: '/mine',
  icon: 'user',
  label: '我的',
};

function TabButton({ tab, active }: { tab: typeof LEFT; active: boolean }) {
  const navigate = useNavigate();
  return (
    <button
      className={cn('tab-item', active && 'active')}
      onClick={() => navigate(tab.to)}
      aria-current={active ? 'page' : undefined}
    >
      <Icon name={tab.icon} size={24} strokeWidth={active ? 2 : 1.7} />
      <span>{tab.label}</span>
    </button>
  );
}

export function TabBar() {
  const { pathname } = useLocation();

  return (
    <div className="tabbar-slot">
      <LiquidGlass
        className="tabbar-glass"
        cornerRadius={26}
        padding="0px"
        displacementScale={26}
        blurAmount={0.16}
        saturation={180}
        aberrationIntensity={1.4}
        elasticity={0.06}
        mode="standard"
        style={{ width: '100%', height: 58 }}
      >
        <nav className="tabbar" aria-label="主导航">
          <TabButton tab={LEFT} active={pathname === LEFT.to} />
          <NowPlayingButton />
          <TabButton tab={RIGHT} active={pathname === RIGHT.to} />
        </nav>
      </LiquidGlass>
    </div>
  );
}
