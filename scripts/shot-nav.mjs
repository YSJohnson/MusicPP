// 验证：双 Tab 导航 / 我的页面卡片 / 搜索页返回
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const OUT = path.resolve('.shots');
if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });
const EDGE = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
].find((p) => existsSync(p));
const BASE = process.env.BASE_URL || 'http://127.0.0.1:4173';

const ctx = await chromium.launchPersistentContext(path.join(OUT, 'edge-nav'), {
  executablePath: EDGE,
  headless: true,
  args: ['--disable-web-security', '--disable-features=IsolateOrigins,site-per-process'],
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  userAgent:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
});

const cover = (n) => `https://picsum.photos/seed/mpp${n}/300/300`;
const song = (n, name, artist) => ({
  hash: `h${n}`,
  name,
  artist,
  album: '测试专辑',
  cover: cover(n),
  duration: 215,
  quality: '320',
});

await ctx.addInitScript(() => {
  const mk = (n, name, artist) => ({
    hash: `h${n}`,
    name,
    artist,
    album: '测试专辑',
    cover: `https://picsum.photos/seed/mpp${n}/300/300`,
    duration: 215,
    quality: '320',
  });
  const queue = [mk(1, '七里香', '周杰伦'), mk(2, '晴天', '周杰伦'), mk(3, '夜曲', '周杰伦'), mk(4, '稻香', '周杰伦')];
  localStorage.setItem(
    'mpp.settings.v1',
    JSON.stringify({
      apiBase: '',
      onboarded: true,
      quality: '320',
      recentSearches: ['周杰伦'],
      lastPlayed: { song: queue[0], queue, index: 0, time: 42 },
      showLyricTranslation: false,
      startupVolume: 1,
    }),
  );
});

const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));

await page.goto(`${BASE}/#/`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2800);
await page.screenshot({ path: path.join(OUT, 'nav-home.png') });
const tabs = await page.locator('.tab-item').allInnerTexts();
console.log('tabs:', tabs.join(' | '));
// 右上角应为搜索按钮
await page.locator('.hero-head .icon-btn').click();
await page.waitForTimeout(1800);
await page.screenshot({ path: path.join(OUT, 'nav-search.png') });
console.log('search url:', page.url());

await page.goto(`${BASE}/#/mine`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2600);
await page.screenshot({ path: path.join(OUT, 'nav-mine.png') });

await ctx.close();
