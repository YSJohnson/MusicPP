import type { Song } from '../api/types';
import { usePlayer } from '../store/player';
import { useSongMenu } from '../store/songMenu';
import { SongRow } from './SongRow';

interface SongListProps {
  songs: Song[];
  context?: string;
  showIndex?: boolean;
  showCover?: boolean;
  /** 不处理点击时回退 */
  onSelect?: (song: Song, index: number) => void;
}

export function SongList({
  songs,
  context = '播放列表',
  showIndex,
  showCover = true,
  onSelect,
}: SongListProps) {
  const currentHash = usePlayer((s) => s.queue[s.index]?.hash);
  const playing = usePlayer((s) => s.playing);
  const playQueue = usePlayer((s) => s.playQueue);
  const openMenu = useSongMenu((s) => s.open);

  return (
    <div className="song-list">
      {songs.map((song, i) => (
        <SongRow
          key={`${song.hash}-${i}`}
          song={song}
          index={i}
          showIndex={showIndex}
          showCover={showCover}
          active={currentHash === song.hash}
          playing={playing}
          onPlay={() => {
            if (onSelect) onSelect(song, i);
            else void playQueue(songs, i, context);
          }}
          onMore={() => openMenu(song)}
        />
      ))}
    </div>
  );
}
