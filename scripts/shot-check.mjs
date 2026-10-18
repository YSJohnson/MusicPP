// 针对性检查：搜索交互、专辑曲目、榜单、我的
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const OUT = path.resolve('.shots');
if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });
const EDGE = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
].find((p) => existsSync(p));

const browser = await chromium.launch({ executablePath: EDGE, headless: true });
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  userAgent:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
});
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
page.on('console', (m) => {
  if (m.type() === 'error') console.log('[console]', m.text().slice(0, 200));
});

const shot = async (name) => {
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  console.log('saved', name);
};

// 搜索 → 输入 → 回车 → 结果
await page.goto('http://127.0.0.1:5173/#/search', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1800);
const input = page.locator('.search-field input');
await input.click();
await input.fill('周杰伦');
await input.press('Enter');
await page.waitForTimeout(2600);
await shot('check-search');

// 切到歌单 tab
await page.locator('.search-tabs .tab', { hasText: '歌单' }).click();
await page.waitForTimeout(2200);
await shot('check-search-playlist');

// 专辑页
await page.goto('http://127.0.0.1:5173/#/album/966846', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2600);
await shot('check-album');

// 榜单页
await page.goto('http://127.0.0.1:5173/#/rank/8888', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2600);
await shot('check-rank');

// 歌手页
await page.goto('http://127.0.0.1:5173/#/artist/3520', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2600);
await shot('check-artist');

await browser.close();
