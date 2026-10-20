/**
 * 接口统一出口
 *
 * 两种运行模式：
 * - 直连模式（默认）：App 内直接调用酷狗接口，签名/加密逻辑见 src/direct
 * - 自建服务模式：如果设置了 API 地址，则请求 KuGouMusicApi 服务
 */
import { ApiError, AuthRequiredError, isDirectMode } from './client';
import { KugouError } from '../direct/http';
import * as direct from '../direct/endpoints';
import * as directLogin from '../direct/login';
import * as server from './server';
import type {
  Lyric,
  Playlist,
  PlaylistDetail,
  QualityInfo,
  QrSession,
  QrStatus,
  RankInfo,
  SearchResult,
  SearchType,
  Song,
  SongClimax,
  UserProfile,
} from './types';

export * from './types';
export { parseLyric } from './lyric';
export { ApiError, AuthRequiredError, isDirectMode } from './client';
export type { TagGroup, ThemeGroup } from './types';

/* -------------------------------- 错误归一化 -------------------------------- */

function mapError(err: unknown): never {
  if (err instanceof KugouError) {
    if (err.code === 20028 || err.code === 20010) {
      throw new AuthRequiredError('需要登录后才能继续', err.status, err.code, err.body);
    }
    throw new ApiError(err.message, err.status, err.code, err.body);
  }
  throw err;
}

async function call<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    mapError(err);
  }
}

/* ----------------------------------- 首页 ----------------------------------- */

export function getDailySongs(): Promise<Song[]> {
  return isDirectMode() ? call(direct.dailySongs) : server.getDailySongs();
}

export function getHomeDiscover(limit = 6): Promise<Song[]> {
  return isDirectMode()
    ? call(() => direct.homeDiscover().then((list) => list.slice(0, limit)))
    : server.getHomeDiscover(limit);
}

export function getPersonalFm(): Promise<Song[]> {
  return isDirectMode() ? call(direct.personalFm) : server.getPersonalFm();
}

export function getPlaylists(categoryId: string | number = 0, page = 1, pagesize = 20): Promise<Playlist[]> {
  return isDirectMode()
    ? call(() => direct.playlists(categoryId, page, pagesize))
    : server.getPlaylists(categoryId, page, pagesize);
}

export function getPlaylistTags() {
  return isDirectMode() ? call(direct.playlistTags) : server.getPlaylistTags();
}

export function getRanks(): Promise<RankInfo[]> {
  return isDirectMode() ? call(direct.ranks) : server.getRanks();
}

export function getNewSongs(page = 1, pagesize = 20): Promise<Song[]> {
  return isDirectMode() ? call(() => direct.newSongs(page, pagesize)) : server.getNewSongs(page, pagesize);
}

export function getThemePlaylists() {
  return isDirectMode() ? call(direct.themePlaylists) : server.getThemePlaylists();
}

/* ----------------------------------- 搜索 ----------------------------------- */

export function search(
  keywords: string,
  type: SearchType,
  page = 1,
  pagesize = 30,
): Promise<SearchResult> {
  return isDirectMode()
    ? call(() => direct.search(keywords, type, page, pagesize))
    : server.search(keywords, type, page, pagesize);
}

export function getHotWords(): Promise<string[]> {
  return isDirectMode() ? call(direct.hotWords) : server.getHotWords();
}

/* -------------------------------- 歌单 / 专辑 ------------------------------- */

export function getPlaylistDetail(id: string): Promise<PlaylistDetail | null> {
  return isDirectMode() ? call(() => direct.playlistDetail(id)) : server.getPlaylistDetail(id);
}

export function getPlaylistSongs(
  globalCollectionId: string,
  page = 1,
  pagesize = 100,
): Promise<{ songs: Song[]; total: number }> {
  return isDirectMode()
    ? call(() => direct.playlistSongs(globalCollectionId, page, pagesize))
    : server.getPlaylistSongs(globalCollectionId, page, pagesize);
}

export function getUserPlaylistSongs(
  listid: string,
  page = 1,
  pagesize = 300,
): Promise<{ songs: Song[]; total: number }> {
  return isDirectMode()
    ? call(() => direct.userPlaylistSongs(listid, page, pagesize))
    : server.getUserPlaylistSongs(listid, page, pagesize);
}

export function getAlbumDetail(id: string) {
  return isDirectMode() ? call(() => direct.albumDetail(id)) : server.getAlbumDetail(id);
}

export function getAlbumSongs(id: string, page = 1, pagesize = 50) {
  return isDirectMode()
    ? call(() => direct.albumSongs(id, page, pagesize))
    : server.getAlbumSongs(id, page, pagesize);
}

export function getAllAlbumSongs(id: string): Promise<{ songs: Song[]; total: number }> {
  return isDirectMode() ? call(() => direct.albumSongs(id, 1, 50).then((r) => r)) : server.getAllAlbumSongs(id);
}

export function getArtistDetail(id: string) {
  return isDirectMode() ? call(() => direct.artistDetail(id)) : server.getArtistDetail(id);
}

export function getArtistSongs(
  id: string,
  page = 1,
  pagesize = 50,
  sort: 'hot' | 'new' = 'hot',
) {
  return isDirectMode()
    ? call(() => direct.artistSongs(id, page, pagesize, sort))
    : server.getArtistSongs(id, page, pagesize, sort);
}

export function getRankSongs(rankid: string | number, page = 1, pagesize = 100) {
  return isDirectMode()
    ? call(() => direct.rankSongs(rankid, page, pagesize))
    : server.getRankSongs(rankid, page, pagesize);
}

/* ------------------------------------ 歌词 ----------------------------------- */

export function getLyric(song: Song): Promise<Lyric | null> {
  return isDirectMode() ? direct.lyric(song) : server.getLyric(song);
}

/* ------------------------------------ 音质 ----------------------------------- */

export function getSongQualities(song: Song): Promise<QualityInfo[]> {
  return isDirectMode() ? direct.qualities(song) : server.getSongQualities(song);
}

export async function getSongClimax(song: Song): Promise<SongClimax | null> {
  try {
    return await (isDirectMode() ? direct.songClimax(song) : server.getSongClimax(song));
  } catch {
    // 部分歌曲没有高潮信息；不影响整曲播放，也不显示猜测的标记。
    return null;
  }
}

export function resolveSongUrl(song: Song, preferred: string): Promise<{ url: string; quality: string }> {
  return isDirectMode()
    ? call(() => direct.songUrl(song, preferred))
    : server.resolveSongUrl(song, preferred);
}

/* ------------------------------------ 登录 ----------------------------------- */

export function createQrSession(): Promise<QrSession> {
  return isDirectMode() ? call(direct.qrSession) : server.createQrSession();
}

export function checkQrSession(key: string): Promise<QrStatus> {
  return isDirectMode() ? call(() => direct.qrStatus(key)) : server.checkQrSession(key);
}

/** 发送手机验证码 */
export function sendLoginCode(mobile: string): Promise<{ count?: number }> {
  return isDirectMode()
    ? call(() => directLogin.sendSmsCode(mobile))
    : server.sendLoginCode(mobile);
}

/** 手机号 + 验证码登录 */
export function loginWithCode(mobile: string, code: string) {
  return isDirectMode()
    ? call(() => directLogin.loginBySms(mobile, code))
    : server.loginWithCode(mobile, code);
}

/* ------------------------------------ 用户 ----------------------------------- */

export function getUserDetail(): Promise<UserProfile | null> {
  return isDirectMode() ? direct.userProfile() : server.getUserDetail();
}

/** 每日签到领取 VIP 时长 */
export function signToday() {
  return isDirectMode() ? direct.dailySign() : server.dailySign();
}

/** 领取 / 升级 1 天概念版 VIP */
export function upgradeVipToday() {
  return isDirectMode() ? direct.upgradeVip() : server.upgradeVip();
}

export function getUserPlaylists(): Promise<Playlist[]> {
  return isDirectMode() ? call(direct.userPlaylists) : server.getUserPlaylists();
}

/* ------------------------------------ 其他 ----------------------------------- */

export function getServerNow(): Promise<any> {
  return isDirectMode() ? Promise.resolve(direct.serverNow()) : server.getServerNow();
}

/** 连接测试：直连模式无需检测 */
export function ping(): Promise<number> {
  return isDirectMode() ? Promise.resolve(0) : server.ping();
}
