import { coverUrl, splitFilename } from '../lib/format';
import type {
  AlbumSummary,
  ArtistSummary,
  Playlist,
  RankInfo,
  Song,
  SongClimax,
  QualityInfo,
  SongSource,
} from './types';

/* ---------------------------------- 基础取值工具 --------------------------------- */

type AnyObj = Record<string, any>;

export const isObj = (v: unknown): v is AnyObj =>
  !!v && typeof v === 'object' && !Array.isArray(v);

export function pick<T = any>(obj: AnyObj | undefined | null, ...keys: string[]): T | undefined {
  if (!obj) return undefined;
  for (const key of keys) {
    const v = key.includes('.')
      ? key.split('.').reduce<any>((acc, part) => (acc == null ? undefined : acc[part]), obj)
      : obj[key];
    if (v !== undefined && v !== null && v !== '') return v as T;
  }
  return undefined;
}

export function pickStr(obj: AnyObj | undefined | null, ...keys: string[]): string | undefined {
  const v = pick(obj, ...keys);
  if (v === undefined) return undefined;
  if (Array.isArray(v)) return v.length ? String(v[0]) : undefined;
  return String(v);
}

export function pickNum(obj: AnyObj | undefined | null, ...keys: string[]): number | undefined {
  const v = pick(obj, ...keys);
  if (v === undefined) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

export function asArray<T = any>(v: unknown): T[] {
  if (Array.isArray(v)) return v as T[];
  if (isObj(v)) return [v as T];
  return [];
}

/* ------------------------------------ 歌曲归一化 ---------------------------------- */

const isVipValue = (v: unknown): boolean => {
  const n = Number(v);
  if (Number.isFinite(n) && n > 0) return true;
  return false;
};

/** 通用歌曲归一化：兼容搜索 / 每日推荐 / 私人FM / 榜单 / 歌单 / 专辑 等多种结构 */
export function toSong(raw: AnyObj | null | undefined, source: SongSource): Song | null {
  if (!isObj(raw)) return null;

  const fileSplit = splitFilename(
    pickStr(raw, 'filename', 'FileName', 'file_name', 'business.filename'),
  );

  // 部分列表（如歌单详情）把歌曲信息放在 audio_info / deprecated 里
  const hash = pickStr(
    raw,
    'hash',
    'FileHash',
    'hash_128',
    'audio_info.hash_128',
    'audio_info.hash',
    'deprecated.hash',
    'deprecated.video_hash',
    'trans_param.ogg_128_hash',
    'ResFileHash',
    'HQFileHash',
  );
  if (!hash) return null;

  const name =
    pickStr(
      raw,
      'songname',
      'SongName',
      'name',
      'base.audio_name',
      'audio_name',
      'ori_audio_name',
      'official_songname',
    ) ||
    fileSplit.name ||
    '未知歌曲';

  const artist =
    pickStr(
      raw,
      'author_name',
      'SingerName',
      'singer',
      'singer_name',
      'base.author_name',
      'singerinfo.0.name',
      'authors.0.author_name',
      'singername',
    ) ||
    fileSplit.artist ||
    '未知歌手';

  const album =
    pickStr(
      raw,
      'album_name',
      'AlbumName',
      'albumname',
      'albuminfo.name',
      'album_info.album_name',
      'base.album_name',
      'album_aux',
    ) || '';

  const albumId = pickStr(
    raw,
    'album_id',
    'AlbumID',
    'albumid',
    'base.album_id',
    'albuminfo.id',
    'album_info.album_id',
  );

  const audioId = pickStr(
    raw,
    'album_audio_id',
    'Audioid',
    'audioid',
    'base.album_audio_id',
    'mixsongid',
    'audio_id',
    'rp_id',
  );

  const cover = coverUrl(
    pickStr(
      raw,
      'sizable_cover',
      'album_sizable_cover',
      'cover',
      'album_info.sizable_cover',
      'album_info.cover',
      'trans_param.union_cover',
      'Image',
      'img',
      'imgurl',
      'pic',
      'album_cover',
      'albuminfo.cover',
    ),
  );

  const durationRaw = pickNum(
    raw,
    'timelength',
    'timelength_128',
    'time_length',
    'timelen',
    'audio_info.duration_128',
    'audio_info.duration',
    'Duration',
    'duration',
    'HQDuration',
  );
  let duration = 0;
  if (durationRaw && durationRaw > 0) duration = durationRaw > 10000 ? durationRaw / 1000 : durationRaw;

  const artistId = pickStr(
    raw,
    'author_id',
    'artist_id',
    'singerinfo.0.id',
    'authors.0.author_id',
    'SingerId',
    'singerid',
  );

  const vip =
    isVipValue(pick(raw, 'privilege', 'Privilege', 'pay_type', 'PayType')) ||
    isVipValue(pick(raw, 'HQPrivilege', 'SQPrivilege'));

  // 歌单曲目接口返回的 name 常是「歌手 - 歌名」的文件名格式，去掉重复的歌手前缀
  let finalName = name;
  const separators = [' - ', '－'];
  for (const sep of separators) {
    if (artist !== '未知歌手' && finalName.startsWith(artist + sep)) {
      finalName = finalName.slice(artist.length + sep.length).trim();
    }
  }
  if (!finalName) finalName = name;

  return {
    key: hash,
    hash,
    name: finalName,
    artist,
    artistId,
    album,
    albumId,
    audioId,
    cover,
    duration,
    vip,
    source,
  };
}

export function toSongs(list: unknown, source: SongSource): Song[] {
  const out: Song[] = [];
  const seen = new Set<string>();
  for (const item of asArray<AnyObj>(list)) {
    const song = toSong(item, source);
    if (!song) continue;
    if (seen.has(song.key)) continue;
    seen.add(song.key);
    out.push(song);
  }
  return out;
}

/* ------------------------------------ 歌单归一化 ---------------------------------- */

export function toPlaylist(raw: AnyObj | null | undefined): Playlist | null {
  if (!isObj(raw)) return null;
  const id = pickStr(
    raw,
    'global_collection_id',
    'gid',
    'listid',
    'specialid',
    'special_id',
    'id',
  );
  if (!id) return null;
  const name = pickStr(raw, 'specialname', 'name', 'title', 'list_name') || '未命名歌单';
  return {
    id,
    name,
    cover: coverUrl(pickStr(raw, 'imgurl', 'img', 'pic', 'flexible_cover', 'cover')),
    creator: pickStr(raw, 'nickname', 'list_create_username', 'username', 'create_username'),
    playCount: pickNum(raw, 'play_count', 'playcount', 'total_play_count', 'heat'),
    count: pickNum(raw, 'song_count', 'count', 'songcount', 'total'),
    description: pickStr(raw, 'intro', 'description'),
    tags: Array.isArray(raw.tags)
      ? raw.tags.map((t: AnyObj) => pickStr(t, 'tag_name', 'name') ?? '').filter(Boolean)
      : pickStr(raw, 'tags')
          ?.split(',')
          .filter(Boolean),
  };
}

export function toPlaylists(list: unknown): Playlist[] {
  return asArray<AnyObj>(list)
    .map(toPlaylist)
    .filter((p): p is Playlist => !!p);
}

/* ------------------------------------ 歌手归一化 ---------------------------------- */

export function toArtist(raw: AnyObj | null | undefined): ArtistSummary | null {
  if (!isObj(raw)) return null;
  const id = pickStr(raw, 'author_id', 'AuthorId', 'singerid', 'artist_id', 'id');
  if (!id) return null;
  return {
    id,
    name: pickStr(raw, 'author_name', 'AuthorName', 'singer', 'name') || '未知歌手',
    avatar: coverUrl(
      pickStr(raw, 'sizable_avatar', 'Avatar', 'avatar', 'img', 'pic', 'FirstFrameImage'),
      240,
    ),
    fans: pickNum(raw, 'fansnums', 'FansNum', 'fans', 'fans_count'),
    songCount: pickNum(raw, 'song_count', 'AudioCount', 'audios_count'),
    albumCount: pickNum(raw, 'album_count', 'AlbumCount'),
    intro: pickStr(raw, 'intro', 'long_intro.0', 'short_intro'),
  };
}

/* ------------------------------------ 专辑归一化 ---------------------------------- */

export function toAlbum(raw: AnyObj | null | undefined): AlbumSummary | null {
  if (!isObj(raw)) return null;
  const id = pickStr(raw, 'album_id', 'albumid', 'AlbumID', 'id');
  if (!id) return null;
  return {
    id,
    name: pickStr(raw, 'album_name', 'albumname', 'AlbumName', 'title') || '未知专辑',
    cover: coverUrl(
      pickStr(raw, 'sizable_cover', 'img', 'Image', 'cover', 'album_sizable_cover'),
    ),
    artist: pickStr(raw, 'author_name', 'singer', 'SingerName', 'singername'),
    artistId: pickStr(raw, 'author_id', 'singerid', 'SingerId'),
    publishDate: pickStr(raw, 'publish_date', 'publish_time', 'publishtime'),
    songCount: pickNum(raw, 'songcount', 'song_count', 'total'),
    intro: pickStr(raw, 'intro', 'short_intro', 'album_name'),
    language: pickStr(raw, 'language'),
  };
}

/* ------------------------------------ 榜单归一化 ---------------------------------- */

export function toRank(raw: AnyObj | null | undefined): RankInfo | null {
  if (!isObj(raw)) return null;
  const id = pickStr(raw, 'rankid', 'rank_id', 'id');
  if (!id) return null;
  return {
    id,
    name: pickStr(raw, 'rankname', 'rank_name', 'name') || '排行榜',
    cover: coverUrl(
      pickStr(raw, 'imgurl', 'img_cover', 'img_9', 'album_img_9', 'bannerurl', 'img'),
    ),
    updateFrequency: pickStr(raw, 'update_frequency', 'update_frequency_type'),
    intro: pickStr(raw, 'intro'),
    playTimes: pickNum(raw, 'play_times', 'playcount', 'play_count'),
  };
}

export function toRanks(list: unknown): RankInfo[] {
  return asArray<AnyObj>(list)
    .map(toRank)
    .filter((r): r is RankInfo => !!r);
}

/* ------------------------------------ 音质标签 ------------------------------------ */

export const QUALITY_LABELS: Record<string, string> = {
  '128': '标准',
  '320': '高品',
  flac: '无损',
  high: 'Hi-Res',
  super: 'DSD',
  viper_clear: '蝰蛇超清',
  viper_tape: '蝰蛇母带',
  viper_atmos: '蝰蛇全景',
};

export const QUALITY_ORDER = ['128', '320', 'flac', 'high', 'super'];

export function qualityLabel(q: string): string {
  return QUALITY_LABELS[q] ?? q.toUpperCase();
}

export function parseQualityList(payload: AnyObj | null | undefined): string[] {
  const list = payload?.quality_vip;
  if (!Array.isArray(list)) return [];
  const best = new Set<string>();
  for (const item of list) {
    if (isObj(item) && Array.isArray(item.qualities)) {
      for (const q of item.qualities) {
        if (isObj(q) && q.obtainable) best.add(String(q.quality));
      }
    }
  }
  return QUALITY_ORDER.filter((q) => best.has(q));
}

const QUALITY_LIST = ['128', '320', 'flac', 'high'] as const;

/** relate_goods 里同音质可能有多条（128 有 ogg/mp3 两版），按官方客户端的 level 优先级挑 */
const QUALITY_LEVEL: Record<string, number[]> = { '128': [1, 2], '320': [4], flac: [5], high: [6] };

/**
 * 解析音质权益。
 *
 * 两种数据来源：
 * - 服务端模式：`quality_vip`（KuGouMusicApi 归一化好的 need_vip / obtainable / exists）
 * - 直连模式：`data[].relate_goods`（酷狗原始权益，privilege≠0 表示需要会员/付费，
 *   status=1 表示当前账号可直接获取——注意未登录时上游对会员音质一律返回 status=0，
 *   不能据此判定「这首歌不可用」，只能判定「当前账号拿不到」）
 */
export function parseSongQualities(payload: AnyObj, hash: string): QualityInfo[] {
  const matches = (item: AnyObj) => !item.hash || String(item.hash).toLowerCase() === hash.toLowerCase();
  const normalized = asArray<AnyObj>(payload?.quality_vip).find(matches);
  const resource = asArray<AnyObj>(payload?.data).find(matches);
  const entries = asArray<AnyObj>(normalized?.qualities);
  const related = asArray<AnyObj>(resource?.relate_goods);
  const transParam = (resource?.trans_param ?? {}) as AnyObj;

  const sizeText = (bytes: number) =>
    bytes > 0
      ? bytes >= 1024 ** 2
        ? `${(bytes / 1024 ** 2).toFixed(1)}M`
        : `${(bytes / 1024).toFixed(1)}K`
      : undefined;

  const pickRelate = (quality: string) => {
    for (const level of QUALITY_LEVEL[quality] ?? []) {
      const hit = related.find(
        (item) => Number(item.level ?? 0) === level && String(item.quality ?? '').toLowerCase() === quality,
      );
      if (hit) return hit;
    }
    return related.find((item) => String(item.quality ?? '').toLowerCase() === quality);
  };

  return QUALITY_LIST.map((quality) => {
    const info = entries.find((entry) => String(entry?.quality ?? '').toLowerCase() === quality);
    const raw = pickRelate(quality);

    // 概念版实际播放的是 ogg 版本，体积以 ogg 文件为准（与客户端弹窗一致）
    const oggSize =
      quality === '128'
        ? Number(transParam.ogg_128_filesize ?? 0)
        : quality === '320'
          ? Number(transParam.ogg_320_filesize ?? 0)
          : 0;

    if (info) {
      // 服务端归一化结果：exists 缺省视为存在
      const missing = info.exists === undefined ? false : !info.exists;
      const needVip = !!info.need_vip;
      const available = info.obtainable === undefined ? !missing && !needVip : !!info.obtainable;
      const size = Number(info.size ?? 0) || oggSize || Number(raw?.info?.filesize ?? 0);
      return {
        quality,
        label: qualityLabel(quality),
        available,
        needVip,
        missing: !!missing,
        sizeText: (typeof info.size_text === 'string' && info.size_text) || sizeText(size),
      };
    }

    if (raw) {
      const needVip = Number(raw.privilege ?? 0) !== 0;
      const statusOk = raw.status === undefined ? true : Number(raw.status) !== 0;
      const size = oggSize || Number(raw.info?.filesize ?? 0);
      return {
        quality,
        label: qualityLabel(quality),
        // 会员音质在未带权益的请求里也是 status=0，这里只标记「需要会员」，
        // 是否真的能播交给 /song/url 决定（失败会按 320 → 128 自动降级）
        available: !needVip && statusOk,
        needVip,
        missing: false,
        sizeText: sizeText(size),
      };
    }

    // 上游没有这首歌的这一档音质
    return {
      quality,
      label: qualityLabel(quality),
      available: false,
      needVip: false,
      missing: true,
      sizeText: undefined,
    };
  });
}

export function parseSongClimax(payload: AnyObj, hash: string): SongClimax | null {
  const rows = asArray<AnyObj>(payload?.data);
  const item = rows.find((row) => String(row.hash ?? '').toLowerCase() === hash.toLowerCase())
    ?? rows.find((row) => !row.hash);
  if (!item || item.start_time === null || item.start_time === undefined) return null;
  if (![item.start_time, item.end_time].every((value) =>
    typeof value === 'number' || (typeof value === 'string' && value.trim() !== ''))) return null;
  const start = Number(item.start_time) / 1000;
  const end = Number(item.end_time) / 1000;
  return Number.isFinite(start) && Number.isFinite(end) && start >= 0 && end > start ? { start, end } : null;
}
