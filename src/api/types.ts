/** 领域模型定义 */

export type SongSource =
  | 'search'
  | 'daily'
  | 'fm'
  | 'rank'
  | 'newsong'
  | 'playlist'
  | 'album'
  | 'artist'
  | 'discover'
  | 'user';

export interface Song {
  /** 唯一键（hash） */
  key: string;
  hash: string;
  name: string;
  artist: string;
  artistId?: string;
  album: string;
  albumId?: string;
  /** album_audio_id，部分接口需要 */
  audioId?: string;
  cover?: string;
  /** 秒 */
  duration: number;
  vip: boolean;
  source: SongSource;
}

export interface Playlist {
  id: string;
  name: string;
  cover?: string;
  creator?: string;
  playCount?: number;
  count?: number;
  description?: string;
  tags?: string[];
}

export interface ArtistSummary {
  id: string;
  name: string;
  avatar?: string;
  fans?: number;
  songCount?: number;
  albumCount?: number;
  intro?: string;
}

export interface AlbumSummary {
  id: string;
  name: string;
  cover?: string;
  artist?: string;
  artistId?: string;
  publishDate?: string;
  songCount?: number;
  intro?: string;
  language?: string;
}

export interface RankInfo {
  id: string;
  name: string;
  cover?: string;
  updateFrequency?: string;
  intro?: string;
  playTimes?: number;
  playCount?: number;
}

export interface PlaylistDetail extends Playlist {
  updateTime?: number;
  count: number;
}

export interface LyricWord {
  time: number;
  dur: number;
  text: string;
}

export interface LyricLine {
  time: number;
  dur: number;
  text: string;
  words?: LyricWord[];
}

export interface Lyric {
  lines: LyricLine[];
  translated?: string[];
  krc: boolean;
}

export interface QualityInfo {
  quality: string;
  label: string;
  available: boolean;
  needVip: boolean;
  sizeText?: string;
}

export interface UserProfile {
  userid: string;
  nickname: string;
  avatar?: string;
  vipType?: number;
  isVip: boolean;
  vipLabel?: string;
  /** 概念版 VIP（product_type = svip） */
  conceptVip?: boolean;
  /** 畅听 VIP（product_type = dvip / qvip） */
  listenVip?: boolean;
  conceptVipExpire?: string;
  listenVipExpire?: string;
  listenCount?: number;
  fans?: number;
  follows?: number;
}

export interface AuthState {
  token: string;
  userid: string;
  profile?: UserProfile;
}

export interface QrSession {
  key: string;
  image: string;
}

export type SearchType = 'song' | 'special' | 'author' | 'album';

/** 搜索结果 */
export interface SearchResult {
  songs: Song[];
  playlists: Playlist[];
  artists: ArtistSummary[];
  albums: AlbumSummary[];
  total: number;
}

/** 歌单分类 */
export interface TagGroup {
  id: string;
  name: string;
  children: { id: string; name: string }[];
}

/** 场景 / 主题歌单 */
export interface ThemeGroup {
  id: string;
  title: string;
  enTitle?: string;
  intro?: string;
  cover?: string;
  listId?: string;
}

/** 扫码状态 */
export interface QrStatus {
  status: number;
  token?: string;
  userid?: string;
  message?: string;
}
