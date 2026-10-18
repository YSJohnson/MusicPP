// 直连模式验证：用禁用浏览器 CORS 的 Edge，模拟 App 内的原生请求
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const OUT = path.resolve('.shots');
if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });
const EDGE = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
].find((p) => existsSync(p));

const ctx = await chromium.launchPersistentContext(path.join(OUT, 'edge-direct-profile'), {
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
// 直连模式：apiBase 为空
await ctx.addInitScript(() => {
  localStorage.setItem(
    'mpp.settings.v1',
    JSON.stringify({
      apiBase: '',
      onboarded: true,
      quality: '320',
      recentSearches: ['周杰伦'],
      lastPlayed: null,
      showLyricTranslation: false,
      startupVolume: 1,
    }),
  );
});

const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
page.on('console', (m) => {
  if (m.type() === 'error') console.log('[console]', m.text().slice(0, 220));
});

const BASE = process.env.BASE_URL || 'http://127.0.0.1:4173';
const shot = async (name) => {
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  console.log('saved', name);
};

await page.goto(`${BASE}/#/`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3200);
await shot('direct-home');

const feed = page.locator('.feed-card').first();
if (await feed.count()) {
  await feed.click();
  await page.waitForTimeout(2200);
  await shot('direct-home-mini');
  const mini = page.locator('.mini .info').first();
  if (await mini.count()) {
    await mini.click();
    await page.waitForTimeout(2800);
    await shot('direct-player');
    await page.locator('.art-shell').first().click();
    await page.waitForTimeout(1800);
    await shot('direct-lyric');
  }
}

await page.goto(`${BASE}/#/discover`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2600);
await shot('direct-discover');

await page.goto(`${BASE}/#/login`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3000);
await shot('direct-login');

await ctx.close();

