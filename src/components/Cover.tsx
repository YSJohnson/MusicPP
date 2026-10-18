import { useState } from 'react';
import { coverUrl } from '../lib/format';
import { Icon } from './Icon';

interface CoverProps {
  src?: string | null;
  alt?: string;
  className?: string;
  size?: number;
  iconSize?: number;
}

/** 封面图，带占位与加载失败兜底 */
export function Cover({ src, alt = '', className = '', size = 480, iconSize = 16 }: CoverProps) {
  const [failed, setFailed] = useState(false);
  const url = coverUrl(src, size);

  if (!url || failed) {
    return (
      <div className={`cover-fallback ${className}`} aria-label={alt}>
        <Icon name="music" size={iconSize} />
      </div>
    );
  }

  return (
    <img
      className={className}
      src={url}
      alt={alt}
      loading="lazy"
      decoding="async"
      draggable={false}
      onError={() => setFailed(true)}
    />
  );
}
