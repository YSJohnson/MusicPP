import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/** 兜底错误边界：避免生产环境白屏 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[Music++] render error', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          display: 'grid',
          placeContent: 'center',
          justifyItems: 'center',
          gap: 14,
          padding: 32,
          background: '#07070b',
          color: '#f5f6f8',
          textAlign: 'center',
          zIndex: 9999,
        }}
      >
        <div
          style={{
            width: 54,
            height: 54,
            borderRadius: 18,
            display: 'grid',
            placeItems: 'center',
            background: 'rgba(255,92,138,.14)',
            border: '1px solid rgba(255,92,138,.3)',
            fontSize: 22,
          }}
        >
          !
        </div>
        <div style={{ fontSize: 17, fontWeight: 700 }}>界面出了点小问题</div>
        <div style={{ fontSize: 12, color: '#8b90a0', maxWidth: 300, lineHeight: 1.7 }}>
          {this.state.error.message}
        </div>
        <button
          onClick={() => {
            this.setState({ error: null });
            window.location.reload();
          }}
          style={{
            marginTop: 6,
            height: 42,
            padding: '0 22px',
            borderRadius: 999,
            border: 'none',
            background: '#fa2d48',
            color: '#ffffff',
            fontWeight: 700,
            fontSize: 14,
          }}
        >
          重新加载
        </button>
      </div>
    );
  }
}
