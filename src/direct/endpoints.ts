import type {
  AlbumSummary,
  ArtistSummary,
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
  TagGroup,
  ThemeGroup,
  UserProfile,
} from '../api/types';
import {
  asArray,
  isObj,
  parseQualityList,
  pickNum,
  pickStr,
  qualityLabel,
  toAlbum,
  toArtist,
  toPlaylist,
  toPlaylists,
  toRank,
  toRanks,
  toSongs,
} from '../api/normalize';
import { parseLyric } from '../api/lyric';
import { getClientAuth } from '../api/client';
import { device, freshDfid, KugouError, kugouRequest } from './http';
import { rsaEncrypt } from './crypto';
import { LITE_APPID, LITE_CLIENTVER, SRCAPPID, signParamsKey } from './sign';
import { decodeKrc } from './krc';

/* ------------------------------------ 首页 ----------------------------------- */

export async function dailySongs(): Promise<Song[]> {
  const body = await kugouRequest<any>({
    url: '/everyday_song_recommend',
    method: 'POST',
    params: { platform: 'ios' },
    headers: { 'x-router': 'everydayrec.service.kugou.com' },
  });
  return toSongs(body?.data?.song_list, 'daily');
}

export async function personalFm(): Promise<Song[]> {
  const auth = getClientAuth();
  const clienttime = Date.now();
  const data: Record<string, any> = {
    appid: LITE_APPID,
    clienttime,
    mid: device().mid,
    action: 'play',
    recommend_source_locked: 0,
    song_pool_id: 0,
    callerid: 0,
    m_type: 1,
    platform: 'ios',
    area_code: 1,
    remain_songcnt: 0,
    clientver: LITE_CLIENTVER,
    is_overplay: 0,
    mode: 'normal',
    fakem: 'ca981cfc583a4c37f28d2d49000013c16a0a',
    key: signParamsKey(clienttime),
  };
  const userid = Number(auth.userid || 0);
  if (userid) {
    data.userid = userid;
    data.kguid = userid;
  }
  if (auth.token) data.token = auth.token;

  const body = await kugouRequest<any>({
    url: '/v2/personal_recommend',
    method: 'POST',
    data,
    headers: { 'x-router': 'persnfm.service.kugou.com' },
  });
  return toSongs(body?.data?.song_list, 'fm');
}

export async function homeDiscover(): Promise<Song[]> {
  const userid = Number(getClientAuth().userid || 0);
  const body = await kugouRequest<any>({
    url: '/homediscoverrec/v1/client/home_discover_rec',
    method: 'POST',
    data: {
      support: 'only_song',
      userid,
      recall_type: 'song',
      today_play_num: 0,
      pagesize: 8,
      go_ky_extra: [
        { key: 'network', val: '2' },
        { key: 'play_mode', val: '2' },
        { key: 'no_mv_ret', val: '1' },
      ],
    },
    params: {
      module_key: 'home_discover_rec',
      module_id: 1,
      area_code: 1,
      platform: 'android',
      userid,
      clientver: 20809,
    },
  });
  const items = asArray<any>(body?.data?.items ?? body?.items);
  const songs = items
    .map((item) => toSongs([item?.song_info ?? item], 'discover'))
    .flat();
  return songs;
}

export async function newSongs(page = 1, pagesize = 20): Promise<Song[]> {
  const userid = Number(getClientAuth().userid || 0);
  const body = await kugouRequest<any>({
    url: '/musicadservice/container/v1/newsong_publish',
    method: 'POST',
    data: { rank_id: 21608, userid, page, pagesize, tags: [] },
  });
  return toSongs(asArray<any>(body?.data), 'newsong');
}

export async function playlists(
  categoryId: string | number = 0,
  page = 1,
  pagesize = 20,
): Promise<Playlist[]> {
  const dateTime = (Date.now() / 1000).toFixed(0);
  const body = await kugouRequest<any>({
    url: '/v2/special_recommend',
    method: 'POST',
    data: {
      appid: LITE_APPID,
      mid: device().mid,
      clientver: LITE_CLIENTVER,
      platform: 'android',
      clienttime: dateTime,
      userid: Number(getClientAuth().userid || 0),
      module_id: 1,
      page,
      pagesize,
      key: signParamsKey(dateTime),
      special_recommend: {
        withtag: 1,
        withsong: 1,
        sort: 1,
        ugc: 1,
        is_selected: 0,
        withrecommend: 1,
        area_code: 1,
        categoryid: categoryId,
      },
      req_multi: 1,
      retrun_min: 5,
      return_special_falg: 1,
    },
    headers: { 'x-router': 'specialrec.service.kugou.com' },
  });
  return toPlaylists(body?.data?.special_list ?? body?.data?.list);
}

export async function playlistTags(): Promise<TagGroup[]> {
  const body = await kugouRequest<any>({
    url: '/pubsongs/v1/get_tags_by_type',
    method: 'POST',
    data: { tag_type: 'collection', tag_id: 0, source: 3 },
  });
  return asArray<any>(body?.data).map((g) => ({
    id: String(pickStr(g, 'tag_id', 'id') ?? ''),
    name: pickStr(g, 'tag_name', 'name') ?? '分类',
    children: asArray<any>(g?.son ?? g?.children).map((c) => ({
      id: String(pickStr(c, 'tag_id', 'id') ?? ''),
      name: pickStr(c, 'tag_name', 'name') ?? '标签',
    })),
  }));
}

export async function ranks(): Promise<RankInfo[]> {
  const body = await kugouRequest<any>({
    url: '/ocean/v6/rank/list',
    params: { plat: 2, withsong: 1, parentid: 0 },
  });
  return toRanks(body?.data?.info ?? body?.data?.list);
}

export async function themePlaylists(): Promise<ThemeGroup[]> {
  const body = await kugouRequest<any>({
    url: '/v2/getthemelist',
    method: 'POST',
    data: {
      platform: 'android',
      clientver: LITE_CLIENTVER,
      clienttime: Date.now(),
      area_code: 1,
      module_id: 1,
      userid: Number(getClientAuth().userid || 0),
    },
    headers: { 'x-router': 'everydayrec.service.kugou.com' },
  });
  return asArray<any>(body?.data?.theme_list ?? body?.data).map((t) => ({
    id: String(pickStr(t, 'id', 'theme_id') ?? ''),
    title: pickStr(t, 'title', 'theme_list_title', 'en_title') ?? '主题歌单',
    enTitle: pickStr(t, 'en_title'),
    intro: pickStr(t, 'intro'),
    cover: pickStr(t, 'pic_net_save', 'pic'),
    listId: pickStr(t, 'global_collection_id', 'list_id'),
  }));
}

/* ------------------------------------ 搜索 ----------------------------------- */

export async function search(
  keywords: string,
  type: SearchType,
  page = 1,
  pagesize = 30,
): Promise<SearchResult> {
  const q = keywords.trim();
  let body: any;
  if (type === 'song') {
    body = await kugouRequest<any>({
      url: '/v2/search/song',
      params: {
        keyword: q,
        page,
        pagesize,
        platform: 'AndroidFilter',
        iscorrection: 1,
        privilegefilter: 0,
        area_code: 1,
        dopicfull: 1,
        clientver: 201,
      },
      headers: { 'x-router': 'complexsearch.kugou.com' },
    });
  } else if (type === 'album') {
    body = await kugouRequest<any>({
      url: '/v1/search/album',
      params: {
        keyword: q,
        page,
        pagesize: 20,
        platform: 'AndroidFilter',
        iscorrection: 1,
        category: '1',
        sorttype: 0,
        searchsong: 0,
        clientver: 201,
      },
      headers: { 'x-router': 'complexsearch.kugou.com' },
    });
  } else {
    body = await kugouRequest<any>({
      url: `/v1/search/${type}`,
      params: {
        albumhide: 0,
        iscorrection: 1,
        keyword: q,
        nocollect: 0,
        page,
        pagesize,
        platform: 'AndroidFilter',
      },
      headers: { 'x-router': 'complexsearch.kugou.com' },
    });
  }

  const data = body?.data ?? body;
  const lists = asArray<any>(data?.lists);
  return {
    songs: type === 'song' ? toSongs(lists, 'search') : [],
    playlists: type === 'special' ? toPlaylists(lists) : [],
    artists:
      type === 'author' ? lists.map(toArtist).filter((a): a is ArtistSummary => !!a) : [],
    albums: type === 'album' ? lists.map(toAlbum).filter((a): a is AlbumSummary => !!a) : [],
    total: Number(pickNum(data, 'total') ?? lists.length),
  };
}

export async function hotWords(): Promise<string[]> {
  const body = await kugouRequest<any>({
    url: '/api/v3/search/hot_tab',
    params: { navid: 1, plat: 2 },
    headers: { 'x-router': 'msearch.kugou.com' },
  });
  const groups = asArray<any>(body?.data?.list ?? body?.data);
  const words: string[] = [];
  for (const g of groups) {
    for (const item of asArray<any>(g?.keywords)) {
      const kw = pickStr(item, 'keyword', 'name');
      if (kw && !words.includes(kw)) words.push(kw);
    }
  }
  return words.slice(0, 24);
}

/* --------------------------------- 歌单 / 专辑 -------------------------------- */

export async function playlistDetail(id: string): Promise<PlaylistDetail | null> {
  const auth = getClientAuth();
  const body = await kugouRequest<any>({
    url: '/v3/get_list_info',
    method: 'POST',
    data: {
      data: [{ global_collection_id: id }],
      userid: Number(auth.userid || 0),
      token: auth.token || '',
    },
    headers: { 'x-router': 'pubsongs.kugou.com' },
  });
  const raw = asArray<any>(body?.data)[0];
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

export async function playlistSongs(
  globalCollectionId: string,
  page = 1,
  pagesize = 100,
): Promise<{ songs: Song[]; total: number }> {
  const body = await kugouRequest<any>({
    url: '/pubsongs/v2/get_other_list_file_nofilt',
    params: {
      area_code: 1,
      begin_idx: (page - 1) * pagesize,
      plat: 1,
      type: 1,
      mode: 1,
      personal_switch: 1,
      extend_fields: 'abtags,hot_cmt,popularization',
      pagesize,
      global_collection_id: globalCollectionId,
    },
  });
  const data = body?.data ?? body;
  return {
    songs: toSongs(data?.songs ?? data?.list ?? data?.info, 'playlist'),
    total: Number(pickNum(data, 'count', 'total') ?? 0),
  };
}

export async function userPlaylistSongs(
  listid: string,
  page = 1,
  pagesize = 300,
): Promise<{ songs: Song[]; total: number }> {
  const auth = getClientAuth();
  const body = await kugouRequest<any>({
    url: '/v4/get_list_all_file_v3',
    method: 'POST',
    data: {
      listid,
      userid: Number(auth.userid || 0),
      type: 0,
      page,
      pagesize,
      area_code: 1,
      allplatform: 1,
      show_cover: 1,
      token: auth.token || '',
    },
    headers: { 'x-router': 'cloudlist.service.kugou.com' },
  });
  const data = body?.data ?? body;
  return {
    songs: toSongs(data?.songs ?? data?.info ?? data?.list ?? data, 'playlist'),
    total: Number(pickNum(data, 'count', 'total') ?? 0),
  };
}

export async function albumDetail(id: string): Promise<AlbumSummary | null> {
  const body = await kugouRequest<any>({
    url: '/kmr/v2/albums',
    method: 'POST',
    data: {
      data: [{ album_id: Number(id) || id }],
      is_buy: 0,
      fields:
        'album_id,album_name,publish_date,sizable_cover,intro,language,is_publish,heat,type,quality,authors,exclusive,author_name,trans_param',
    },
    headers: { 'x-router': 'openapi.kugou.com', 'kg-tid': '255' },
  });
  return toAlbum(asArray<any>(body?.data)[0]);
}

export async function albumSongs(
  id: string,
  page = 1,
  pagesize = 50,
): Promise<{ songs: Song[]; total: number }> {
  const body = await kugouRequest<any>({
    url: '/v1/album_audio/lite',
    method: 'POST',
    data: { album_id: id, is_buy: '', page, pagesize },
    headers: { 'x-router': 'openapi.kugou.com', 'kg-tid': '255' },
  });
  const data = body?.data ?? body;
  return {
    songs: toSongs(data?.songs ?? data, 'album'),
    total: Number(pickNum(data, 'total') ?? 0),
  };
}

export async function artistDetail(id: string): Promise<ArtistSummary | null> {
  const body = await kugouRequest<any>({
    url: '/kmr/v3/author',
    method: 'POST',
    data: { author_id: Number(id) || id },
    headers: { 'x-router': 'openapi.kugou.com', 'kg-tid': 36 },
  });
  return toArtist(body?.data ?? body);
}

export async function artistSongs(
  id: string,
  page = 1,
  pagesize = 50,
  sort: 'hot' | 'new' = 'hot',
): Promise<{ songs: Song[]; total: number }> {
  const clienttime = Math.floor(Date.now() / 1000);
  const body = await kugouRequest<any>({
    baseURL: 'https://openapi.kugou.com',
    url: '/kmr/v1/audio_group/author',
    method: 'POST',
    data: {
      appid: LITE_APPID,
      clientver: LITE_CLIENTVER,
      mid: device().mid,
      clienttime,
      key: signParamsKey(clienttime),
      author_id: id,
      pagesize,
      page,
      sort: sort === 'hot' ? 1 : 2,
      area_code: 'all',
    },
    headers: { 'x-router': 'openapi.kugou.com', 'kg-tid': 220 },
  });
  return {
    songs: toSongs(asArray<any>(body?.data), 'artist'),
    total: Number(pickNum(body, 'total') ?? 0),
  };
}

export async function rankSongs(
  rankid: string | number,
  page = 1,
  pagesize = 100,
): Promise<{ songs: Song[]; total: number }> {
  const body = await kugouRequest<any>({
    url: '/openapi/kmr/v2/rank/audio',
    method: 'POST',
    data: {
      show_portrait_mv: 1,
      show_type_total: 1,
      filter_original_remarks: 1,
      area_code: 1,
      pagesize,
      rank_cid: 0,
      type: 1,
      page,
      rank_id: rankid,
    },
    headers: { 'kg-tid': '369' },
  });
  const data = body?.data ?? body;
  return {
    songs: toSongs(data?.songlist ?? data?.songs ?? data?.info, 'rank'),
    total: Number(pickNum(data, 'total') ?? pickNum(body, 'total') ?? 0),
  };
}

/* ------------------------------------ 歌词 ----------------------------------- */

export async function lyric(song: Song): Promise<Lyric | null> {
  try {
    const search = await kugouRequest<any>({
      baseURL: 'https://lyrics.kugou.com',
      url: '/v1/search',
      params: {
        album_audio_id: 0,
        appid: LITE_APPID,
        clientver: LITE_CLIENTVER,
        duration: Math.round(song.duration || 0),
        hash: song.hash,
        keyword: `${song.artist} - ${song.name}`,
        lrctxt: 1,
        man: 'no',
      },
      clearDefaultParams: true,
    });
    const candidates = asArray<any>(search?.candidates ?? search?.data?.candidates);
    const target = candidates[0];
    const id = pickStr(target, 'id');
    const accesskey = pickStr(target, 'accesskey');
    if (!id || !accesskey) return null;

    const body = await kugouRequest<any>({
      baseURL: 'https://lyrics.kugou.com',
      url: '/download',
      params: { ver: 1, client: 'android', id, accesskey, fmt: 'krc', charset: 'utf8' },
    });
    const content = pickStr(body, 'content');
    const contentType = Number(pickNum(body, 'contenttype') ?? 0);
    if (!content) return null;
    const text = contentType === 0 ? decodeKrc(content) : atob(content);
    return parseLyric(text);
  } catch {
    return null;
  }
}

/* ------------------------------------ 音质 ----------------------------------- */

export async function qualities(song: Song): Promise<QualityInfo[]> {
  try {
    const body = await kugouRequest<any>({
      url: '/v2/get_res_privilege/lite',
      method: 'POST',
      data: {
        appid: LITE_APPID,
        area_code: 1,
        behavior: 'play',
        clientver: LITE_CLIENTVER,
        need_hash_offset: 1,
        relate: 1,
        support_verify: 1,
        resource: [{ type: 'audio', page_id: 0, hash: song.hash, album_id: Number(song.albumId ?? 0) }],
        qualities: ['128', '320', 'flac', 'high'],
      },
      headers: { 'x-router': 'media.store.kugou.com', 'Content-Type': 'application/json' },
    });
    const available = new Set(parseQualityList(body));
    return ['128', '320', 'flac', 'high'].map((q) => ({
      quality: q,
      label: qualityLabel(q),
      available: available.has(q),
      needVip: !available.has(q),
    }));
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
    Array.isArray(json.data) ? json.data[0]?.url : undefined,
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

export async function songUrl(song: Song, preferred: string): Promise<{ url: string; quality: string }> {
  const tried = new Set<string>();
  const order = [preferred, '320', '128'].filter((q) => {
    if (!q || tried.has(q)) return false;
    tried.add(q);
    return true;
  });

  let authError: KugouError | null = null;
  let lastMessage = '';

  for (const quality of order) {
    const body = await kugouRequest<any>({
      url: '/v5/url',
      params: {
        album_id: Number(song.albumId ?? 0),
        area_code: 1,
        hash: song.hash.toLowerCase(),
        ssa_flag: 'is_fromtrack',
        version: 11430,
        page_id: 967177915,
        quality,
        album_audio_id: Number(song.audioId ?? 0),
        behavior: 'play',
        pid: 411,
        cmd: 26,
        pidversion: 3001,
        IsFreePart: 0,
        ppage_id: '356753938,823673182,967485191',
        cdnBackup: 1,
        module: '',
        clientver: 11430,
      },
      headers: { 'x-router': 'trackercdn.kugou.com' },
      encryptKey: true,
      dfid: freshDfid(),
    });
    const url = pickUrl(body);
    if (url) return { url, quality };
    lastMessage = pickStr(body, 'error', 'errmsg', 'msg') ?? lastMessage;
  }

  // 备用：priv_url 接口
  try {
    const clienttime = Date.now();
    const auth = getClientAuth();
    const body = await kugouRequest<any>({
      baseURL: 'http://tracker.kugou.com',
      url: '/v6/priv_url',
      method: 'POST',
      data: {
        area_code: '1',
        behavior: 'play',
        qualities: ['128', '320', 'flac', 'high'],
        resource: {
          album_audio_id: Number(song.audioId ?? 0),
          collect_list_id: '3',
          collect_time: clienttime,
          hash: song.hash,
          id: 0,
          page_id: 1,
          type: 'audio',
        },
        token: auth.token || '',
        tracker_param: {
          all_m: 1,
          auth: '',
          is_free_part: 0,
          key: signParamsKey(clienttime),
          module_id: 0,
          need_climax: 1,
          need_xcdn: 1,
          open_time: '',
          pid: '411',
          pidversion: '3001',
          priv_vip_type: '6',
          viptoken: '',
        },
        userid: String(auth.userid || 0),
        vip: 0,
      },
    });
    const url = pickUrl(body);
    if (url) return { url, quality: 'auto' };
  } catch {
    /* ignore */
  }

  if (authError) throw authError;
  throw new KugouError(lastMessage || '暂时无法获取播放地址（可能受版权或会员限制）');
}

/* ------------------------------------ 登录 ----------------------------------- */

export async function qrSession(): Promise<QrSession> {
  const body = await kugouRequest<any>({
    baseURL: 'https://login-user.kugou.com',
    url: '/v2/qrcode',
    params: {
      appid: 1001,
      type: 1,
      plat: 4,
      qrcode_txt: `https://h5.kugou.com/apps/loginQRCode/html/index.html?appid=${LITE_APPID}&`,
      srcappid: SRCAPPID,
    },
    encryptType: 'web',
  });
  const key = pickStr(body?.data, 'qrcode');
  if (!key) throw new KugouError('无法生成登录二维码');

  // 用 SVG 生成二维码，避免 canvas 在部分 WebView 上不可用
  const QRCode = (await import('qrcode')).default;
  const svg = await QRCode.toString(
    `https://h5.kugou.com/apps/loginQRCode/html/index.html?qrcode=${key}`,
    { type: 'svg', margin: 1, color: { dark: '#0b0d05', light: '#ffffff' } },
  );
  const image = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  return { key, image };
}

export async function qrStatus(key: string): Promise<QrStatus> {
  const body = await kugouRequest<any>({
    baseURL: 'https://login-user.kugou.com',
    url: '/v2/get_userinfo_qrcode',
    params: {
      plat: 4,
      appid: LITE_APPID,
      srcappid: SRCAPPID,
      qrcode: key,
      dev: device().dev,
    },
    encryptType: 'web',
  });
  const data = body?.data ?? body;
  return {
    status: Number(pickNum(data, 'status') ?? 1),
    token: pickStr(data, 'token'),
    userid: pickStr(data, 'userid'),
    message: pickStr(data, 'message', 'error'),
  };
}

/* ------------------------------------ 签到 ----------------------------------- */

export type SignStatus = 'success' | 'already' | 'blocked' | 'failed';

export interface SignResult {
  status: SignStatus;
  message: string;
}

/** 本地日期 YYYY-MM-DD（酷狗签到按天计算） */
function signDayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function codeOf(err: unknown): number {
  if (err instanceof KugouError) return Number(err.body?.error_code ?? err.code ?? 0);
  return 0;
}

function signError(err: unknown): SignResult {
  const code = codeOf(err);
  if (code === 131001 || code === 130012) return { status: 'already', message: '今天已经签过到了' };
  if (code === 20028) return { status: 'blocked', message: '账号存在风控，请前往手机酷狗领取' };
  if (code === 51002 || code === 20018) return { status: 'failed', message: '登录状态已失效，请重新登录' };
  const detail = err instanceof KugouError ? pickStr(err.body, 'error_msg', 'msg') : undefined;
  return { status: 'failed', message: detail || (err instanceof Error ? err.message : '签到失败') };
}

/**
 * 每日签到：领取畅听 VIP 时长。
 * 对应概念版「个人中心 → 签到」，参数为当天日期。
 */
export async function dailySign(): Promise<SignResult> {
  const auth = getClientAuth();
  if (!auth.token) throw new KugouError('需要登录后才能签到', 0, 20010);

  const receiveDay = signDayKey();
  try {
    const body = await kugouRequest<any>({
      url: '/youth/v1/recharge/receive_vip_listen_song',
      method: 'POST',
      params: { source_id: 90139, receive_day: receiveDay },
      encryptType: 'android',
    });
    return {
      status: 'success',
      message: pickStr(body?.data, 'msg', 'message') || '签到成功，已领取 VIP 时长',
    };
  } catch (err) {
    return signError(err);
  }
}

/**
 * 领取/升级概念版 VIP（一天一次）。
 * 对应概念版「个人中心 → VIP」按钮。
 */
export async function upgradeVip(): Promise<SignResult> {
  const auth = getClientAuth();
  if (!auth.token) throw new KugouError('需要登录后才能领取', 0, 20010);

  try {
    const body = await kugouRequest<any>({
      url: '/youth/v1/listen_song/upgrade_vip_reward',
      method: 'POST',
      params: { kugouid: Number(auth.userid), ad_type: 1 },
      encryptType: 'android',
    });
    return {
      status: 'success',
      message: pickStr(body?.data, 'msg', 'message') || '领取成功，已获得 1 天 VIP',
    };
  } catch (err) {
    return signError(err);
  }
}
/* ------------------------------------ 会员 ----------------------------------- */

export interface VipDetail {
  concept: boolean;
  listen: boolean;
  conceptExpire?: string;
  listenExpire?: string;
}

/** 查询概念版 VIP / 畅听 VIP 状态（kugouvip 联盟会员接口） */
export async function vipDetail(): Promise<VipDetail | null> {
  const auth = getClientAuth();
  if (!auth.token) return null;
  try {
    const body = await kugouRequest<any>({
      baseURL: 'https://kugouvip.kugou.com',
      url: '/v1/get_union_vip',
      method: 'GET',
      params: { busi_type: 'concept' },
      headers: { Referer: 'https://vip.kugou.com/' },
      encryptType: 'android',
    });

    // busi_vip 一般是 [概念版, 畅听版] 两项，按位置判断，再用 product_type 兜底
    const list = asArray<any>(body?.data?.busi_vip);
    const active = (it: any) => Number(it?.is_vip) === 1;
    const typeOf = (it: any) => String(it?.product_type ?? '').toLowerCase();
    const concept =
      list.find((it) => active(it) && typeOf(it) === 'svip') ?? (active(list[0]) ? list[0] : undefined);
    const listen =
      list.find(
        (it) => active(it) && it !== concept && ['dvip', 'qvip'].includes(typeOf(it)),
      ) ??
      list.find((it) => active(it) && it !== concept) ??
      (active(list[1]) && list[1] !== concept ? list[1] : undefined);

    return {
      concept: !!concept,
      listen: !!listen,
      conceptExpire: concept ? pickStr(concept, 'vip_end_time', 'expire_time') : undefined,
      listenExpire: listen ? pickStr(listen, 'vip_end_time', 'expire_time') : undefined,
    };
  } catch {
    return null;
  }
}
/* ------------------------------------ 用户 ----------------------------------- */

export async function userProfile(): Promise<UserProfile | null> {
  const auth = getClientAuth();
  if (!auth.token || !auth.userid) return null;

  // 酷狗用 RSA 加密 token + 秒级时间戳来校验身份
  const clienttime = Math.floor(Date.now() / 1000);
  const pk = rsaEncrypt({ token: auth.token, clienttime }).toUpperCase();
  const body = await kugouRequest<any>({
    url: '/v3/get_my_info',
    method: 'POST',
    params: { plat: 1 },
    data: {
      visit_time: clienttime,
      usertype: 1,
      p: pk,
      userid: Number(auth.userid),
    },
    encryptType: 'android',
    headers: { 'x-router': 'usercenter.kugou.com' },
  });

  const data = body?.data;
  if (!isObj(data)) return null;

  const vip = await vipDetail();
  const vipType = pickNum(data, 'vip_type', 'vipType', 'is_vip') ?? 0;
  const conceptVip = Boolean(vip?.concept);
  const listenVip = Boolean(vip?.listen);
  const isVip = conceptVip || listenVip || vipType > 0;
  return {
    userid: String(pickNum(data, 'userid', 'user_id') ?? auth.userid),
    nickname: pickStr(data, 'nickname', 'username', 'nick_name', 'name') || '酷狗用户',
    avatar: pickStr(data, 'pic', 'user_pic', 'avatar', 'headimg', 'head_img', 'img'),
    vipType,
    isVip,
    vipLabel: conceptVip ? '概念VIP' : listenVip ? '畅听VIP' : isVip ? 'VIP' : undefined,
    conceptVip,
    listenVip,
    conceptVipExpire: vip?.conceptExpire,
    listenVipExpire: vip?.listenExpire,
    listenCount: pickNum(data, 'listen_song_count', 'listen_count', 'listen_num'),
    fans: pickNum(data, 'fans_count', 'fans_num', 'fans'),
    follows: pickNum(data, 'follow_count', 'follow_num', 'follows'),
  };
}

export async function userPlaylists(): Promise<Playlist[]> {
  const auth = getClientAuth();
  if (!auth.token) throw new KugouError('需要登录后才能查看歌单', 0, 20010);
  const body = await kugouRequest<any>({
    url: '/v7/get_all_list',
    method: 'POST',
    data: {
      userid: Number(auth.userid || 0),
      token: auth.token,
      total_ver: 979,
      type: 2,
      page: 1,
      pagesize: 100,
    },
    params: { plat: 1, userid: Number(auth.userid || 0), token: auth.token },
    headers: { 'x-router': 'cloudlist.service.kugou.com' },
  });
  const data = body?.data ?? body;
  return toPlaylists(asArray<any>(data?.info ?? data?.list ?? data));
}

export function serverNow(): { timestamp: number } {
  return { timestamp: Date.now() };
}
