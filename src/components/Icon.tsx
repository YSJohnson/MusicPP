import type { CSSProperties, ReactNode } from 'react';

const paths: Record<string, ReactNode> = {
  home: <path d="M4 10.6 12 4l8 6.6V19a2 2 0 0 1-2 2h-3.6v-6.2H9.6V21H6a2 2 0 0 1-2-2z" />,
  compass: (
    <>
      <circle cx="12" cy="12" r="8.6" />
      <path d="m15.6 8.4-2.3 5-4.9 2.2 2.3-5z" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.6" />
      <path d="m16 16 4 4" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8.4" r="3.9" />
      <path d="M4.6 20.2c.8-3.7 3.8-5.7 7.4-5.7s6.6 2 7.4 5.7" />
    </>
  ),
  play: <path d="M8 5.4v13.2L19 12z" fill="currentColor" stroke="none" />,
  pause: (
    <>
      <rect x="7.2" y="5.4" width="3.6" height="13.2" rx="1.5" fill="currentColor" stroke="none" />
      <rect x="13.2" y="5.4" width="3.6" height="13.2" rx="1.5" fill="currentColor" stroke="none" />
    </>
  ),
  prev: (
    <>
      <path d="M19 6.4v11.2L10.2 12z" fill="currentColor" stroke="none" />
      <rect x="5" y="6" width="2.2" height="12" rx="1.1" fill="currentColor" stroke="none" />
    </>
  ),
  next: (
    <>
      <path d="M5 6.4v11.2L13.8 12z" fill="currentColor" stroke="none" />
      <rect x="16.8" y="6" width="2.2" height="12" rx="1.1" fill="currentColor" stroke="none" />
    </>
  ),
  chevronLeft: <path d="M15 4.8 7.8 12l7.2 7.2" />,
  chevronRight: <path d="M9 4.8 16.2 12 9 19.2" />,
  chevronDown: <path d="M4.8 9 12 16.2 19.2 9" />,
  down: <path d="M12 4.5v11M7.5 11.5 12 16l4.5-4.5M5 19.5h14" />,
  more: (
    <>
      <circle cx="5.4" cy="12" r="1.7" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.7" fill="currentColor" stroke="none" />
      <circle cx="18.6" cy="12" r="1.7" fill="currentColor" stroke="none" />
    </>
  ),
  close: <path d="M6 6l12 12M18 6 6 18" />,
  plus: <path d="M12 5v14M5 12h14" />,
  check: <path d="m5 12.5 4.5 4.5L19 7" />,
  heart: (
    <path d="M12 20.2c-.4 0-.7-.1-1-.4C8.3 17.4 4 13.9 4 10.4 4 7.7 6.1 5.6 8.7 5.6c1.3 0 2.5.6 3.3 1.6.8-1 2-1.6 3.3-1.6 2.6 0 4.7 2.1 4.7 4.8 0 3.5-4.3 7-7 9.4-.3.3-.6.4-1 .4z" />
  ),
  queue: (
    <>
      <path d="M4 7h11M4 12h11M4 17h7" />
      <path d="M18.6 8.4v7.8" />
      <circle cx="17" cy="17.4" r="2.2" />
    </>
  ),
  repeat: (
    <>
      <path d="M6.6 8.2h9.6a3.6 3.6 0 0 1 3.6 3.6v1.4" />
      <path d="m8.8 5.4-2.7 2.8 2.7 2.8" />
      <path d="M17.4 15.8H7.8a3.6 3.6 0 0 1-3.6-3.6v-1.4" />
      <path d="m15.2 18.6 2.7-2.8-2.7-2.8" />
    </>
  ),
  single: (
    <>
      <path d="M6.6 8.2h9.6a3.6 3.6 0 0 1 3.6 3.6v1.4" />
      <path d="m8.8 5.4-2.7 2.8 2.7 2.8" />
      <path d="M17.4 15.8H7.8a3.6 3.6 0 0 1-3.6-3.6v-1.4" />
      <path d="m15.2 18.6 2.7-2.8-2.7-2.8" />
      <path d="M11.8 10.6v3.6" strokeWidth="1.5" />
    </>
  ),
  shuffle: (
    <>
      <path d="M4 7h3.4c1 0 1.9.5 2.5 1.3l3.4 4.6c.6.8 1.5 1.3 2.5 1.3H20" />
      <path d="m17.4 11.4 2.8 2.8-2.8 2.8" />
      <path d="M4 17h3.4c1 0 1.9-.5 2.5-1.3l.9-1.2" />
      <path d="m14.2 9.4.9-1.1c.6-.8 1.5-1.3 2.5-1.3H20" />
    </>
  ),
  order: (
    <>
      <path d="M9 6.5h11M9 12h11M9 17.5h11" />
      <path d="M4.4 6.5h.01M4.4 12h.01M4.4 17.5h.01" strokeWidth="2.2" />
    </>
  ),
  music: (
    <>
      <path d="M9.4 17.4V6.6l9-2v10.8" />
      <circle cx="7" cy="17.6" r="2.4" />
      <circle cx="16" cy="15.6" r="2.4" />
    </>
  ),
  disc: (
    <>
      <circle cx="12" cy="12" r="8.6" />
      <circle cx="12" cy="12" r="2.4" />
    </>
  ),
  fire: (
    <path d="M12 3.4c2.6 3 4.9 5 4.9 8.2A4.9 4.9 0 0 1 12 16.5a4.9 4.9 0 0 1-4.9-4.9c0-1.4.4-2.6 1.2-3.7.3 1.3 1 2.1 2 2.4-.4-2 .3-4.4 1.7-6.9z" />
  ),
  sparkle: (
    <>
      <path d="M12 4.2l1.7 4.6 4.6 1.7-4.6 1.7L12 16.8l-1.7-4.6L5.7 10.5l4.6-1.7z" />
      <path d="M18.4 15.6l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" />
    </>
  ),
  calendar: (
    <>
      <rect x="4.2" y="5.8" width="15.6" height="14.4" rx="3.4" />
      <path d="M8.4 3.6v3.6M15.6 3.6v3.6M4.2 10.4h15.6" />
    </>
  ),
  trending: (
    <>
      <path d="m4 16.4 5-5 3.4 3.4 6.2-6.4" />
      <path d="M14.6 8.4h4.6v4.6" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.4" />
      <path d="M12 7.6V12l3 1.8" />
    </>
  ),
  settings: (
    <>
      <path d="M4 7h7M15.4 7H20M4 12h3.4M11.6 12H20M4 17h9.4M17.2 17H20" />
      <circle cx="13.4" cy="7" r="2.1" />
      <circle cx="9.4" cy="12" r="2.1" />
      <circle cx="15" cy="17" r="2.1" />
    </>
  ),
  server: (
    <>
      <rect x="3.6" y="4.4" width="16.8" height="6.2" rx="2.2" />
      <rect x="3.6" y="13.4" width="16.8" height="6.2" rx="2.2" />
      <path d="M7.2 7.5h.01M7.2 16.5h.01" strokeWidth="2.4" />
    </>
  ),
  logout: (
    <>
      <path d="M14.4 5.4H7.6a2 2 0 0 0-2 2v9.2a2 2 0 0 0 2 2h6.8" />
      <path d="M16.6 8.8 20 12l-3.4 3.2M11 12h8.6" />
    </>
  ),
  qr: (
    <>
      <rect x="4" y="4" width="6.4" height="6.4" rx="1.6" />
      <rect x="13.6" y="4" width="6.4" height="6.4" rx="1.6" />
      <rect x="4" y="13.6" width="6.4" height="6.4" rx="1.6" />
      <path d="M13.6 13.6h2.8v2.8h-2.8zM17.8 17.8h2.2v2.2h-2.2z" />
    </>
  ),
  refresh: (
    <>
      <path d="M19.4 12a7.4 7.4 0 1 1-2.4-5.4" />
      <path d="M19.8 4.6v4.4h-4.4" />
    </>
  ),
  trash: (
    <>
      <path d="M5.6 7.2h12.8M9.4 7.2V5.4a1.8 1.8 0 0 1 1.8-1.8h1.6a1.8 1.8 0 0 1 1.8 1.8v1.8" />
      <path d="M7.2 7.2l.8 11a2 2 0 0 0 2 1.8h4a2 2 0 0 0 2-1.8l.8-11" />
    </>
  ),
  share: (
    <>
      <path d="M12 15.6V4.6M8.6 8 12 4.6 15.4 8" />
      <path d="M5.6 13.4v4.2a2 2 0 0 0 2 2h8.8a2 2 0 0 0 2-2v-4.2" />
    </>
  ),
  folder: (
    <path d="M4 8.2a2.4 2.4 0 0 1 2.4-2.4h2.9l1.6 2h6.7A2.4 2.4 0 0 1 20 10.2v6.4a2.4 2.4 0 0 1-2.4 2.4H6.4A2.4 2.4 0 0 1 4 16.6z" />
  ),
  headphones: (
    <>
      <path d="M4.6 15.4v-2.8a7.4 7.4 0 0 1 14.8 0v2.8" />
      <rect x="3.2" y="14.4" width="4" height="6" rx="2" />
      <rect x="16.8" y="14.4" width="4" height="6" rx="2" />
    </>
  ),
  wifi: (
    <>
      <path d="M3.4 9.2a12.6 12.6 0 0 1 17.2 0M6.6 12.6a8 8 0 0 1 10.8 0M9.8 16a3.4 3.4 0 0 1 4.4 0" />
      <circle cx="12" cy="19.4" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  edit: (
    <>
      <path d="M16.4 4.6 19.4 7.6 9 18H6v-3z" />
      <path d="M14.6 6.4 17.6 9.4" />
    </>
  ),
  volume: (
    <>
      <path d="M11.4 4.8 6.8 9H4v6h2.8l4.6 4.2z" />
      <path d="M15.4 8.8a4.6 4.6 0 0 1 0 6.4M18 6.4a8.2 8.2 0 0 1 0 11.2" />
    </>
  ),
  github: (
    <path
      d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2.2c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1.1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.3-5.5-5.9 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.6 1.7.2 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .3z"
      fill="currentColor"
      stroke="none"
    />
  ),
};

export type IconName = keyof typeof paths;

export interface IconProps {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  filled?: boolean;
  className?: string;
  style?: CSSProperties;
}

export function Icon({ name, size = 22, strokeWidth = 1.75, filled = false, className, style }: IconProps) {
  const isFilled = filled;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={isFilled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

export function LogoMark({ size = 34 }: { size?: number }) {
  return (
    <div className="logo-mark" style={{ width: size, height: size, borderRadius: size * 0.32 }}>
      <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 64 64" fill="none">
        <path
          d="M14 46V20l11 13 11-13v26"
          stroke="#0B1103"
          strokeWidth="7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M48 25v13M41.5 31.5h13" stroke="#0B1103" strokeWidth="6" strokeLinecap="round" />
      </svg>
    </div>
  );
}
