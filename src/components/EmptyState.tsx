import type { ReactNode } from 'react';
import { Icon } from './Icon';
import type { IconName } from './Icon';

interface EmptyStateProps {
  icon?: IconName;
  text: string;
  action?: ReactNode;
}

export function EmptyState({ icon = 'music', text, action }: EmptyStateProps) {
  return (
    <div className="empty">
      <div className="emoji">
        <Icon name={icon} size={24} />
      </div>
      <p>{text}</p>
      {action}
    </div>
  );
}

export function SkeletonRows({ count = 6 }: { count?: number }) {
  return (
    <div className="song-list">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="song-row" aria-hidden>
          <div className="skeleton" style={{ width: 46, height: 46, borderRadius: 12 }} />
          <div className="song-main">
            <div className="skeleton" style={{ width: `${52 + ((i * 13) % 30)}%`, height: 12 }} />
            <div
              className="skeleton"
              style={{ width: `${30 + ((i * 7) % 22)}%`, height: 9, marginTop: 8 }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SkeletonGrid({ count = 4 }: { count?: number }) {
  return (
    <div className="grid-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i}>
          <div className="skeleton" style={{ width: '100%', aspectRatio: '1 / 1', borderRadius: 16 }} />
          <div className="skeleton" style={{ width: '76%', height: 11, marginTop: 10 }} />
          <div className="skeleton" style={{ width: '44%', height: 9, marginTop: 7 }} />
        </div>
      ))}
    </div>
  );
}
