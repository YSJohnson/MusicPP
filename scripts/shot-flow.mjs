// 交互流程截图：首页 → 迷你播放器 → 播放器 → 歌词 → 其他页面
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
  if (m.type() === 'error') console.log('[console]', m.text().slice(0, 400));
});

const shot = async (name) => {
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  console.log('saved', name);
};

await page.goto('http://127.0.0.1:5173/#/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2600);
await shot('01-home');

// 点击「为你推荐」第一张卡片 → 生成队列
const feed = page.locator('.feed-card').first();
if (await feed.count()) {
  await feed.click();
  await page.waitForTimeout(1500);
  await shot('02-home-mini');

  const mini = page.locator('.mini .info').first();
  if (await mini.count()) {
    await mini.click();
    await page.waitForTimeout(2600);
    await shot('03-player');

    await page.locator('.art-shell').first().click();
    await page.waitForTimeout(1600);
    await shot('04-lyric');
  }
}

for (const [route, name] of [
  ['/#/discover', '05-discover'],
  ['/#/search', '06-search'],
  ['/#/mine', '07-mine'],
  ['/#/ranks', '08-ranks'],
]) {
  await page.goto(`http://127.0.0.1:5173${route}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await shot(name);
}

// 歌单详情页
await page.goto('http://127.0.0.1:5173/#/discover', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2200);
const pl = page.locator('.pl-card').first();
if (await pl.count()) {
  await pl.click();
  await page.waitForTimeout(2600);
  await shot('09-playlist');
}

await browser.close();
