// 验证生产构建（minified）在「已配置服务器」状态下的渲染
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

// 预置：已完成引导 + 指向本机 API
await ctx.addInitScript(() => {
  localStorage.setItem(
    'mpp.settings.v1',
    JSON.stringify({
      apiBase: 'http://127.0.0.1:3000',
      onboarded: true,
      quality: '320',
      recentSearches: ['周杰伦', '夜曲'],
      lastPlayed: null,
      showLyricTranslation: false,
      startupVolume: 1,
    }),
  );
});

const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
page.on('console', (m) => {
  if (m.type() === 'error') console.log('[console]', m.text().slice(0, 200));
});

const BASE = process.env.BASE_URL || 'http://127.0.0.1:4173';
for (const [route, name] of [
  ['/#/', 'prod-home'],
  ['/#/search', 'prod-search'],
  ['/#/mine', 'prod-mine'],
]) {
  await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2400);
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  console.log('saved', name);
}

await browser.close();
