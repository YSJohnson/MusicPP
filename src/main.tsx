import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import './styles/base.css';
import './styles/shell.css';
import './styles/pages.css';
import './styles/player.css';
import './styles/extra.css';

const root = createRoot(document.getElementById('root')!);
root.render(
  <ErrorBoundary>
    <HashRouter>
      <App />
    </HashRouter>
  </ErrorBoundary>,
);

// 移除启动闪屏
requestAnimationFrame(() => {
  const boot = document.getElementById('boot');
  if (boot) {
    boot.style.opacity = '0';
    window.setTimeout(() => boot.remove(), 420);
  }
});
