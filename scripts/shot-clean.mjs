// 干净的首页/滚动截图（无本地播放记录），用于文档
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

const run = async (scheme) => {
  const ctx = await chromium.launchPersistentContext(path.join(OUT, `edge-clean-${scheme}`), {
    executablePath: EDGE,
    headless: true,
    args: ['--disable-web-security', '--disable-features=IsolateOrigins,site-per-process'],
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    colorScheme: scheme,
    userAgent:
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
  });
  await ctx.addInitScript(() => {
    localStorage.setItem(
      'mpp.settings.v1',
      JSON.stringify({
        apiBase: '',
        onboarded: true,
        quality: '320',
        recentSearches: [],
        lastPlayed: null,
        showLyricTranslation: false,
        startupVolume: 1,
      }),
    );
  });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/#/`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(OUT, `clean-${scheme}.png`) });
  await page.evaluate(() => {
    const el = document.querySelector('.page');
    if (el) el.scrollTop = 560;
  });
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(OUT, `clean-${scheme}-scroll.png`) });
  console.log('saved', scheme);
  await ctx.close();
};

await run('light');
await run('dark');
