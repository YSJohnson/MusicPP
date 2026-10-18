import { useEffect, useRef } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { MiniPlayer } from './components/MiniPlayer';
import { useNativeShell } from './hooks/useNativeShell';
import { useAutoSign } from './hooks/useAutoSign';
import { SongMenu } from './components/SongMenu';
import { TabBar } from './components/TabBar';
import { ToastHost } from './components/ToastHost';
import { cn } from './lib/cn';
import { AlbumPage } from './pages/AlbumPage';
import { ArtistPage } from './pages/ArtistPage';
import { HomePage } from './pages/Home';
import { ListPage } from './pages/ListPage';
import { LoginPage } from './pages/Login';
import { MinePage } from './pages/Mine';
import { PlayerPage } from './pages/Player';
import { PlaylistPage } from './pages/PlaylistPage';
import { RankPage, RanksPage } from './pages/RankPage';
import { SearchPage } from './pages/Search';
import { SettingsPage } from './pages/Settings';
import { useAuth } from './store/auth';
import { usePlayer } from './store/player';
import { useSettings } from './store/settings';

const MAIN_TABS = ['/', '/mine'];

export default function App() {
  useEffect(() => {
    useSettings.getState().init();
    useAuth.getState().init();
  }, []);

  return <Shell />;
}

function Shell() {
  const location = useLocation();
  const hasQueue = usePlayer((s) => s.queue.length > 0);
  const isPlayer = location.pathname === '/player';

  // 播放器作为覆盖层渲染：底层页面保持挂载，返回时不会重新请求 / 丢滚动位置
  const lastPathRef = useRef('/');
  if (!isPlayer && location.pathname) lastPathRef.current = location.pathname;
  const basePath = isPlayer ? lastPathRef.current : location.pathname;

  const isMainTab = MAIN_TABS.includes(basePath);
  const showMini = hasQueue && !isPlayer && !isMainTab;
  useNativeShell();
  useAutoSign();

  return (
    <div
      className={cn(
        'app',
        showMini && 'with-mini',
        !isMainTab && !isPlayer && 'no-tabs',
      )}
    >
      <main className="app-main">
        <Routes location={{ ...location, pathname: basePath }}>
          <Route path="/" element={<HomePage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/mine" element={<MinePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/playlist/:id" element={<PlaylistPage />} />
          <Route path="/album/:id" element={<AlbumPage />} />
          <Route path="/artist/:id" element={<ArtistPage />} />
          <Route path="/rank/:id" element={<RankPage />} />
          <Route path="/ranks" element={<RanksPage />} />
          <Route path="/list/:kind" element={<ListPage />} />
          <Route path="*" element={<HomePage />} />
        </Routes>
        {isPlayer && <PlayerPage />}
      </main>

      {!isPlayer && (isMainTab || hasQueue) && (
        <div className="dock">{isMainTab ? <TabBar /> : <MiniPlayer />}</div>
      )}

      <ToastHost />
      <SongMenu />
    </div>
  );
}
