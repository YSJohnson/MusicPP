import type {
  AlbumSummary,
  ArtistSummary,
  Lyric,
  LyricLine,
  LyricWord,
  Playlist,
  PlaylistDetail,
  QualityInfo,
  RankInfo,
  QrSession,
  SearchType,
  Song,
  SongSource,
  UserProfile,
} from './types';
import { ApiError, AuthRequiredError, cachedRequest, rawRequest, request } from './client';
import { parseLyric } from './lyric';
import {
  asArray,
  isObj,
  pickNum,
  pickStr,
  parseQualityList,
  qualityLabel,
  toAlbum,
  toArtist,
  toPlaylist,
  toPlaylists,
  toRank,
  toRanks,
  toSong,
  toSongs,
} from './normalize';

/* ------------------------------------- 首页 ------------------------------------- */

/** 每日推荐 */
export async function getDailySongs(): Promise<Song[]> {
  const res = await cachedRequest<any>('/everyday/recommend', undefined, 5 * 60_000);
  return toSongs(res?.data?.song_list ?? res?.song_list, 'daily');
}

/** 首页刷歌推荐（沉浸式推荐流） */
export async function getHomeDiscover(limit = 6): Promise<Song[]> {
  const res = await cachedRequest<any>('/home/discover', undefined, 3 * 60_000);
  const items = asArray<any>(res?.data?.items ?? res?.items);
  const songs = items
    .map((item) => toSong(item?.song_info ?? item, 'discover'))
    .filter((s): s is Song => !!s);
  return songs.slice(0, limit);
}

/** 猜你喜欢 / 私人 FM */
export async function getPersonalFm(): Promise<Song[]> {
  const res = await cachedRequest<any>('/personal/fm', { _t: Date.now() }, 60_000);
  return toSongs(res?.data?.song_list ?? res?.song_list, 'fm');
}

/** 推荐歌单（歌单广场） */
export async function getPlaylists(
  categoryId: string | number = 0,
  page = 1,
  pagesize = 20,
): Promise<Playlist[]> {
  const res = await cachedRequest<any>(
    '/top/playlist',
    { category_id: categoryId, page, pagesize },
    5 * 60_000,
  );
  return toPlaylists(res?.data?.special_list ?? res?.data?.list ?? res?.special_list);
}

/** 歌单分类标签 */
export interface TagGroup {
  id: string;
  name: string;
  children: { id: string; name: string }[];
}

export async function getPlaylistTags(): Promise<TagGroup[]> {
  const res = await cachedRequest<any>('/playlist/tags', undefined, 30 * 60_000);
  const list = asArray<any>(res?.data);
  return list.map((g) => ({
    id: String(pickStr(g, 'tag_id', 'id') ?? ''),
    name: pickStr(g, 'tag_name', 'name') ?? '分类',
    children: asArray<any>(g?.son ?? g?.children).map((c) => ({
      id: String(pickStr(c, 'tag_id', 'id') ?? ''),
      name: pickStr(c, 'tag_name', 'name') ?? '标签',
    })),
  }));
}

/** 排行榜列表 */
export async function getRanks(): Promise<RankInfo[]> {
  const res = await cachedRequest<any>('/rank/list', { withsong: 0 }, 10 * 60_000);
  return toRanks(res?.data?.info ?? res?.data?.list ?? res?.info);
}

/** 新歌速递 */
export async function getNewSongs(page = 1, pagesize = 20): Promise<Song[]> {
  const res = await cachedRequest<any>('/top/song', { page, pagesize }, 10 * 60_000);
  return toSongs(asArray<any>(res?.data), 'newsong');
}

/** 主题歌单（场景） */
export interface ThemeGroup {
  id: string;
  title: string;
  enTitle?: string;
  intro?: string;
  cover?: string;
  listId?: string;
}

export async function getThemePlaylists(): Promise<ThemeGroup[]> {
  const res = await cachedRequest<any>('/theme/playlist', undefined, 15 * 60_000);
  const list = asArray<any>(res?.data?.theme_list ?? res?.data);
  return list.map((t) => {
    const cover = pickStr(t, 'pic_net_save', 'pic');
    return {
      id: String(pickStr(t, 'id', 'theme_id') ?? ''),
      title: pickStr(t, 'title', 'theme_list_title', 'en_title') ?? '主题歌单',
      enTitle: pickStr(t, 'en_title'),
      intro: pickStr(t, 'intro'),
      cover,
      listId: pickStr(t, 'global_collection_id', 'list_id'),
    };
  });
}

/* ------------------------------------- 搜索 ------------------------------------- */

export interface SearchResult {
  songs: Song[];
  playlists: Playlist[];
  artists: ArtistSummary[];
  albums: AlbumSummary[];
  total: number;
}

export async function search(
  keywords: string,
  type: SearchType,
  page = 1,
  pagesize = 30,
): Promise<SearchResult> {
  const res = await request<any>('/search', { keywords, type, page, pagesize });
  const data = res?.data ?? res;
  const lists = asArray<any>(data?.lists);
  const total = Number(pickNum(data, 'total') ?? lists.length);
  return {
    songs: type === 'song' ? toSongs(lists, 'search') : [],
    playlists: type === 'special' ? toPlaylists(lists) : [],
    artists:
      type === 'author'
        ? lists.map((a) => toArtist(a)).filter((a): a is ArtistSummary => !!a)
        : [],
    albums: type === 'album' ? lists.map((a) => toAlbum(a)).filter((a): a is AlbumSummary => !!a) : [],
    total,
  };
}

export async function getHotWords(): Promise<string[]> {
  try {
    const res = await cachedRequest<any>('/search/hot', undefined, 10 * 60_000);
    const groups = asArray<any>(res?.data?.list ?? res?.data);
    const words: string[] = [];
    for (const g of groups) {
      for (const item of asArray<any>(g?.keywords)) {
        const kw = pickStr(item, 'keyword', 'name');
        if (kw && !words.includes(kw)) words.push(kw);
      }
    }
    return words.slice(0, 24);
  } catch {
    return [];
  }
}

/* ----------------------------------- 歌单 / 专辑 ----------------------------------- */

export async function getPlaylistDetail(id: string): Promise<PlaylistDetail | null> {
  const res = await request<any>('/playlist/detail', { ids: id });
  const raw = asArray<any>(res?.data)[0];
  if (!raw) return null;
  const base = toPlaylist(raw);
  if (!base) return null;
  return {
    ...base,
    id,
    count: pickNum(raw, 'count', 'song_count', 'total') ?? 0,
    updateTime: pickNum(raw, 'update_time', 'create_time'),
  };
}

export async function getPlaylistSongs(
  globalCollectionId: string,
  page = 1,
  pagesize = 100,
): Promise<{ songs: Song[]; total: number }> {
  const res = await request<any>('/playlist/track/all', {
    id: globalCollectionId,
    page,
    pagesize,
  });
  const data = res?.data ?? res;
  return {
    songs: toSongs(data?.songs ?? data?.list ?? data?.info, 'playlist'),
    total: Number(pickNum(data, 'count', 'total') ?? 0),
  };
}

/** 用户歌单曲目（新版接口，支持自己创建/收藏的歌单） */
export async function getUserPlaylistSongs(
  listid: string,
  page = 1,
  pagesize = 300,
): Promise<{ songs: Song[]; total: number }> {
  const res = await request<any>('/playlist/track/all/new', { listid, page, pagesize });
  const data = res?.data ?? res;
  return {
    songs: toSongs(data?.songs ?? data?.info ?? data?.list ?? data, 'playlist'),
    total: Number(pickNum(data, 'count', 'total') ?? 0),
  };
}

export async function getAlbumDetail(id: string): Promise<AlbumSummary | null> {  const res = await request<any>('/album/detail', { id });
  const raw = asArray<any>(res?.data)[0] ?? res?.data;
  return toAlbum(raw);
}

export async function getAlbumSongs(
  id: string,
  page = 1,
  pagesize = 50,
): Promise<{ songs: Song[]; total: number }> {
  const res = await request<any>('/album/songs', { id, page, pagesize });
  const data = res?.data ?? res;
  return {
    songs: toSongs(data?.songs ?? data, 'album'),
    total: Number(pickNum(data, 'total') ?? 0),
  };
}

/** 专辑曲目全量拉取（上游单页上限 50 首，这里自动翻页） */
export async function getAllAlbumSongs(id: string): Promise<{ songs: Song[]; total: number }> {
  const first = await getAlbumSongs(id, 1, 50);
  let songs = first.songs;
  const total = first.total;
  for (let page = 2; page <= 8 && songs.length < total; page++) {
    const next = await getAlbumSongs(id, page, 50).catch(() => null);
    if (!next?.songs.length) break;
    songs = [...songs, ...next.songs];
  }
  const seen = new Set<string>();
  songs = songs.filter((s) => (seen.has(s.hash) ? false : (seen.add(s.hash), true)));
  return { songs, total: Math.max(total, songs.length) };
}

export async function getArtistDetail(id: string): Promise<ArtistSummary | null> {
  const res = await request<any>('/artist/detail', { id });
  return toArtist(res?.data ?? res);
}

export async function getArtistSongs(
  id: string,
  page = 1,
  pagesize = 50,
  sort: 'hot' | 'new' = 'hot',
): Promise<{ songs: Song[]; total: number }> {
  const res = await request<any>('/artist/audios', { id, page, pagesize, sort });
  const data = res?.data;
  return {
    songs: toSongs(asArray<any>(data), 'artist'),
    total: Number(pickNum(res, 'total') ?? 0),
  };
}

export async function getRankSongs(
  rankid: string | number,
  page = 1,
  pagesize = 100,
): Promise<{ songs: Song[]; total: number }> {
  const res = await request<any>('/rank/audio', { rankid, page, pagesize });
  const data = res?.data ?? res;
  return {
    songs: toSongs(data?.songlist ?? data?.songs ?? data?.info, 'rank'),
    total: Number(pickNum(data, 'total') ?? pickNum(res, 'total') ?? 0),
  };
}

/* ------------------------------------- 歌词 ------------------------------------- */

export { parseLyric };

export async function getLyric(song: Song): Promise<Lyric | null> {
  try {
    const res = await request<any>('/search/lyric', {
      hash: song.hash,
      keywords: `${song.artist} - ${song.name}`,
      duration: Math.round(song.duration || 0),
      man: 'no',
    });
    const candidates = asArray<any>(
      res?.candidates ?? res?.data?.candidates ?? res?.body?.candidates,
    );
    const target =
      candidates.find((c) => pickStr(c, 'krctype') === 'krc') ?? candidates[0];
    const id = pickStr(target, 'id') ?? pickStr(res, 'id');
    const accesskey = pickStr(target, 'accesskey') ?? pickStr(res, 'accesskey');
    if (!id || !accesskey) return null;

    const lyric = await request<any>('/lyric', {
      id,
      accesskey,
      fmt: 'krc',
      decode: 'true',
      client: 'android',
    });
    const content =
      pickStr(lyric, 'decodeContent') ??
      pickStr(lyric?.body, 'decodeContent') ??
      pickStr(lyric, 'content') ??
      pickStr(lyric?.body, 'content');
    return parseLyric(content) ?? null;
  } catch {
    return null;
  }
}

/* ------------------------------------- 音质 ------------------------------------- */

export async function getSongQualities(song: Song): Promise<QualityInfo[]> {
  try {
    const res = await request<any>('/privilege/lite', { hash: song.hash, album_id: song.albumId });
    const available = new Set(parseQualityList(res));
    const all: QualityInfo[] = ['128', '320', 'flac', 'high'].map((q) => ({
      quality: q,
      label: qualityLabel(q),
      available: available.has(q),
      needVip: !available.has(q),
    }));
    return all;
  } catch {
    return ['128', '320', 'flac'].map((q) => ({
      quality: q,
      label: qualityLabel(q),
      available: true,
      needVip: false,
    }));
  }
}

function pickUrl(json: any): string | undefined {
  if (!json) return undefined;
  const candidates: any[] = [
    json.url,
    json.urls,
    json.backupUrl,
    json.backup_url,
    json.data?.url,
    json.data?.urls,
    json.data?.backupUrl,
    Array.isArray(json.data) ? json.data[0]?.url : undefined,
    Array.isArray(json.data) ? json.data[0]?.backupUrl : undefined,
    json.data?.data?.url,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && /^https?:\/\//i.test(c)) return c;
    if (Array.isArray(c)) {
      const first = c.find((x) => typeof x === 'string' && /^https?:\/\//i.test(x));
      if (first) return first;
      const objUrl = c.find((x) => isObj(x) && typeof x.url === 'string' && /^https?:/i.test(x.url));
      if (objUrl) return objUrl.url;
    }
  }
  return undefined;
}

export interface SongUrlResult {
  url: string;
  quality: string;
}

/** 解析播放地址：优先请求的音质，失败后逐级降级 */
export async function resolveSongUrl(song: Song, preferred: string): Promise<SongUrlResult> {
  const tried = new Set<string>();
  const order = [preferred, '320', '128'].filter((q) => {
    if (!q || tried.has(q)) return false;
    tried.add(q);
    return true;
  });

  let authError: AuthRequiredError | null = null;
  let lastMessage = '';

  for (const quality of order) {
    const res = await rawRequest('/song/url', {
      hash: song.hash,
      album_id: song.albumId,
      album_audio_id: song.audioId,
      quality,
    });
    const url = pickUrl(res.json);
    if (url) return { url, quality };
    const code = Number(res.json?.error_code ?? res.json?.errcode ?? 0);
    const message = String(res.json?.error ?? res.json?.errmsg ?? res.json?.message ?? '');
    lastMessage = message || lastMessage;
    if (code === 20028 || /需要验证|check r failed/i.test(message)) {
      authError = new AuthRequiredError('需要登录后才能获取播放地址', res.status, code, res.json);
    }
  }

  // 备用：新版接口（部分歌曲仅在 priv_url 中可拿）
  try {
    const alt = await rawRequest('/song/url/new', {
      hash: song.hash,
      album_id: song.albumId,
      album_audio_id: song.audioId,
    });
    const url = pickUrl(alt.json);
    if (url) return { url, quality: 'auto' };
    const code = Number(alt.json?.error_code ?? alt.json?.errcode ?? 0);
    if (code === 20028) {
      authError = new AuthRequiredError('需要登录后才能获取播放地址', alt.status, code, alt.json);
    }
  } catch {
    /* ignore */
  }

  if (authError) throw authError;
  throw new ApiError(lastMessage || '暂时无法获取播放地址（可能受版权或会员限制）');
}

/* ------------------------------------- 登录 ------------------------------------- */

export async function createQrSession(): Promise<QrSession> {
  const res = await request<any>('/login/qr/key');
  const data = res?.data ?? res;
  const key = pickStr(data, 'qrcode', 'key', 'qrcode_key');
  const image = pickStr(data, 'qrcode_img', 'base64', 'img');
  if (!key) throw new ApiError('无法生成登录二维码');
  return { key, image: image ?? '' };
}

export interface QrStatus {
  status: number;
  token?: string;
  userid?: string;
  message?: string;
}

export async function checkQrSession(key: string): Promise<QrStatus> {
  const res = await request<any>('/login/qr/check', { key });
  const data = res?.data ?? res;
  return {
    status: Number(pickNum(data, 'status') ?? 1),
    token: pickStr(data, 'token'),
    userid: pickStr(data, 'userid'),
    message: pickStr(data, 'message', 'error'),
  };
}

/* ------------------------------------- 用户 ------------------------------------- */

export async function getUserDetail(): Promise<UserProfile | null> {
  const res = await request<any>('/user/detail');
  const data = res?.data ?? res;
  if (!isObj(data)) return null;
  const vipType = pickNum(data, 'vip_type', 'viptype', 'vipType');
  const nickname =
    pickStr(data, 'nickname', 'nick_name', 'user_name', 'username', 'kugouid_name') ?? '酷狗用户';
  const isVip = (vipType ?? 0) > 0 || pickStr(data, 'vip_label') !== undefined;
  return {
    userid: pickStr(data, 'userid', 'user_id', 'kugouid') ?? '',
    nickname,
    avatar: pickStr(data, 'pic', 'avatar', 'img', 'headimg', 'portrait'),
    vipType,
    isVip,
    vipLabel: isVip ? (vipType === 2 ? '概念版 VIP' : 'VIP') : undefined,
    listenCount: pickNum(data, 'listen_song_count', 'listen_count'),
    fans: pickNum(data, 'fans_num', 'fansnums'),
    follows: pickNum(data, 'follow_num', 'follows'),
  };
}

export async function getUserPlaylists(): Promise<Playlist[]> {
  const res = await request<any>('/user/playlist', { page: 1, pagesize: 100 });
  const data = res?.data ?? res;
  const list = asArray<any>(data?.info ?? data?.list ?? data);
  return toPlaylists(list);
}

/* ------------------------------------ 其他工具 ----------------------------------- */

export async function getServerNow(): Promise<any> {
  return request<any>('/server/now');
}

/** 连接测试 */
export async function ping(): Promise<number> {
  const start = Date.now();
  await request<any>('/server/now', undefined, { timeout: 8000 });
  return Date.now() - start;
}


/* ---------------------------------- 验证码登录 --------------------------------- */

/** 发送手机验证码（自建服务模式） */
export async function sendLoginCode(mobile: string): Promise<{ count?: number }> {
  const res = await request<any>('/captcha/sent', { mobile });
  return res?.data ?? {};
}

/** 手机号 + 验证码登录（自建服务模式） */
export async function loginWithCode(
  mobile: string,
  code: string,
): Promise<{ token: string; userid: string; vipType?: number }> {
  const res = await request<any>('/login/cellphone', { mobile, code });
  const data = res?.data ?? res;
  const token = pickStr(data, 'token');
  const userid = pickStr(data, 'userid');
  if (!token || !userid) throw new ApiError('登录失败：未获取到账号信息');
  return { token, userid, vipType: pickNum(data, 'vip_type') };
}

/* ---------------------------------- 每日签到 ---------------------------------- */

function signDayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function toSignResult(err: unknown): { status: 'already' | 'blocked' | 'failed'; message: string } {
  const message = err instanceof Error ? err.message : '领取失败';
  if (/已领取|已签到|131001|130012/.test(message)) return { status: 'already', message: '今天已经领过了' };
  if (/20028|风控/.test(message)) return { status: 'blocked', message: '账号存在风控，请前往手机酷狗领取' };
  return { status: 'failed', message };
}

export async function dailySign(): Promise<{ status: 'success' | 'already' | 'blocked' | 'failed'; message: string }> {
  try {
    const res = await request<any>('/youth/day/vip', { receive_day: signDayKey() });
    return { status: 'success', message: pickStr(res?.data, 'msg') || '签到成功' };
  } catch (err) {
    return toSignResult(err);
  }
}

export async function upgradeVip(): Promise<{ status: 'success' | 'already' | 'blocked' | 'failed'; message: string }> {
  try {
    const res = await request<any>('/youth/day/vip/upgrade', {});
    return { status: 'success', message: pickStr(res?.data, 'msg') || '领取成功' };
  } catch (err) {
    return toSignResult(err);
  }
}