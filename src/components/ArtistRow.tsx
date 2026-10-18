import type { AlbumSummary, ArtistSummary } from '../api/types';
import { fmtCount } from '../lib/format';
import { Cover } from './Cover';
import { Icon } from './Icon';

export function ArtistRow({ artist, onClick }: { artist: ArtistSummary; onClick: () => void }) {
  return (
    <button className="artist-row tap" onClick={onClick}>
      <Cover className="artist-avatar" src={artist.avatar} alt={artist.name} size={240} />
      <div className="song-main">
        <div className="song-name">
          <span className="txt">{artist.name}</span>
        </div>
        <div className="song-sub">
          {artist.fans ? `${fmtCount(artist.fans)} 粉丝` : '歌手'}
          {artist.songCount ? ` · ${artist.songCount} 首单曲` : ''}
        </div>
      </div>
      <Icon name="chevronRight" size={16} className="dim" />
    </button>
  );
}

export function AlbumRow({ album, onClick }: { album: AlbumSummary; onClick: () => void }) {
  return (
    <button className="artist-row tap" onClick={onClick}>
      <Cover className="album-cover" src={album.cover} alt={album.name} size={240} />
      <div className="song-main">
        <div className="song-name">
          <span className="txt">{album.name}</span>
        </div>
        <div className="song-sub">
          {album.artist ?? '未知歌手'}
          {album.publishDate ? ` · ${album.publishDate.slice(0, 10)}` : ''}
          {album.songCount ? ` · ${album.songCount} 首` : ''}
        </div>
      </div>
      <Icon name="chevronRight" size={16} className="dim" />
    </button>
  );
}
