import { Icon } from './Icon';

interface SectionHeaderProps {
  kicker?: string;
  title: string;
  more?: string;
  onMore?: () => void;
}

export function SectionHeader({ kicker, title, more, onMore }: SectionHeaderProps) {
  return (
    <div className="section-head">
      <div className="titles">
        {kicker && <div className="kicker">{kicker}</div>}
        <h2>{title}</h2>
      </div>
      {more && (
        <button className="more" onClick={onMore}>
          {more}
          <Icon name="chevronRight" size={13} strokeWidth={2} />
        </button>
      )}
    </div>
  );
}
