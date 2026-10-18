// 直连模式联调脚本：在 Node 中验证签名与各接口（不依赖自建 API 服务）
import { writeFileSync } from 'node:fs';

const mem = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
  setItem: (k: string, v: string) => void mem.set(k, v),
  removeItem: (k: string) => void mem.delete(k),
};

const direct = await import('../src/direct/endpoints');

const result: Record<string, any> = {};
const step = async (name: string, fn: () => Promise<any>, summarize: (v: any) => any) => {
  const started = Date.now();
  try {
    const value = await fn();
    result[name] = { ok: true, ms: Date.now() - started, data: summarize(value) };
    console.log(`✔ ${name} (${Date.now() - started}ms)`);
  } catch (err: any) {
    result[name] = { ok: false, ms: Date.now() - started, error: String(err?.message || err), code: err?.code };
    console.log(`✘ ${name}: ${err?.message || err} ${err?.code ? `(code ${err.code})` : ''}`);
  }
};

let firstSong: any = null;
let firstPlaylist: any = null;

await step('dailySongs', direct.dailySongs, (l) => ({ count: l.length, first: l[0] && `${l[0].name} - ${l[0].artist}` }));
await step('personalFm', direct.personalFm, (l) => ({ count: l.length, first: l[0] && `${l[0].name} - ${l[0].artist}` }));
await step('homeDiscover', direct.homeDiscover, (l) => ({ count: l.length, first: l[0] && l[0].name }));
await step('playlists', () => direct.playlists(0, 1, 6), (l) => {
  firstPlaylist = l[0];
  return { count: l.length, first: l[0] && `${l[0].name} / ${l[0].id}` };
});
await step('playlistTags', direct.playlistTags, (l) => ({ groups: l.length, first: l[0]?.name }));
await step('ranks', direct.ranks, (l) => ({ count: l.length, first: l[0] && l[0].name }));
await step('newSongs', () => direct.newSongs(1, 10), (l) => ({ count: l.length, first: l[0] && `${l[0].name} - ${l[0].artist}` }));
await step('search', () => direct.search('周杰伦', 'song', 1, 5), (r) => {
  firstSong = r.songs[0];
  return { total: r.total, count: r.songs.length, first: r.songs[0] && `${r.songs[0].name} / ${r.songs[0].artist}` };
});
await step('searchSpecial', () => direct.search('周杰伦', 'special', 1, 3), (r) => ({ total: r.total, count: r.playlists.length }));
await step('searchArtist', () => direct.search('周杰伦', 'author', 1, 3), (r) => ({ total: r.total, count: r.artists.length }));
await step('searchAlbum', () => direct.search('周杰伦', 'album', 1, 3), (r) => ({ total: r.total, count: r.albums.length }));
await step('hotWords', direct.hotWords, (l) => ({ count: l.length, first: l.slice(0, 3) }));
await step('themePlaylists', direct.themePlaylists, (l) => ({ count: l.length, first: l[0]?.title }));

if (firstPlaylist) {
  await step('playlistDetail', () => direct.playlistDetail(firstPlaylist.id), (v) => ({ name: v?.name, count: v?.count, creator: v?.creator }));
  await step('playlistSongs', () => direct.playlistSongs(firstPlaylist.id, 1, 5), (v) => ({ count: v.songs.length, total: v.total, first: v.songs[0] && `${v.songs[0].name} - ${v.songs[0].artist}` }));
}

await step('albumDetail', () => direct.albumDetail('966846'), (v) => ({ name: v?.name, artist: v?.artist, songs: v?.songCount }));
await step('albumSongs', () => direct.albumSongs('966846', 1, 10), (v) => ({ count: v.songs.length, total: v.total, first: v.songs[0] && v.songs[0].name }));
await step('artistDetail', () => direct.artistDetail('3520'), (v) => ({ name: v?.name, songs: v?.songCount }));
await step('artistSongs', () => direct.artistSongs('3520', 1, 5, 'hot'), (v) => ({ count: v.songs.length, first: v.songs[0] && v.songs[0].name }));
await step('rankSongs', () => direct.rankSongs('8888', 1, 5), (v) => ({ count: v.songs.length, total: v.total, first: v.songs[0] && v.songs[0].name }));

if (firstSong) {
  await step('lyric', () => direct.lyric(firstSong), (v) => ({ lines: v?.lines.length, krc: v?.krc, first: v?.lines[0]?.text }));
  await step('qualities', () => direct.qualities(firstSong), (v) => ({ list: v.map((q) => `${q.quality}:${q.available}`).join(',') }));
}

await step('songUrl(未登录，预期20028)', () => direct.songUrl(firstSong ?? { hash: 'B3A52A7A958BF0AED0EBFBA2E9A818B7', name: '晴天', artist: '周杰伦', album: '', duration: 269, vip: true, source: 'search', key: 'x' } as any, '128'), (v) => v);

await step('qrSession', direct.qrSession, (v) => ({ key: v.key, imageLen: v.image.length }));
await step('qrStatus', async () => direct.qrStatus('expiredtestkey'), (v) => v);

writeFileSync('.shots/direct-test.json', JSON.stringify(result, null, 2));
console.log('\n结果已写入 .shots/direct-test.json');
