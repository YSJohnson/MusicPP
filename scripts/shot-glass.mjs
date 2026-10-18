// 验证底栏玻璃效果：滚动到有封面的位置截图
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

const launch = (scheme) =>
  chromium.launchPersistentContext(path.join(OUT, `edge-glass-${scheme}`), {
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

const seed = async (ctx) => {
  await ctx.addInitScript(() => {
    const mk = (n, name, artist) => ({
      hash: `h${n}`,
      name,
      artist,
      album: '测试专辑',
      cover: `https://picsum.photos/seed/glass${n}/300/300`,
      duration: 215,
      quality: '320',
    });
    const queue = [mk(1, '七里香', '周杰伦'), mk(2, '晴天', '周杰伦')];
    localStorage.setItem(
      'mpp.settings.v1',
      JSON.stringify({
        apiBase: '',
        onboarded: true,
        quality: '320',
        recentSearches: [],
        lastPlayed: { song: queue[0], queue, index: 0, time: 42 },
        showLyricTranslation: false,
        startupVolume: 1,
      }),
    );
  });
};

const run = async (scheme) => {
  const ctx = await launch(scheme);
  await seed(ctx);
  const page = await ctx.newPage();
  await page.goto(`${BASE}/#/`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(OUT, `glass-${scheme}-top.png`) });
  await page.evaluate(() => {
    const el = document.querySelector('.page');
    if (el) el.scrollTop = 520;
  });
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(OUT, `glass-${scheme}-scroll.png`) });
  console.log('saved', scheme);
  await ctx.close();
};

await run('light');
await run('dark');
