// 全站截图：直连模式 + 禁用 CORS 的 Edge，模拟 App 内原生请求
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

const launch = async (colorScheme) =>
  chromium.launchPersistentContext(path.join(OUT, `edge-all-${colorScheme}`), {
    executablePath: EDGE,
    headless: true,
    args: ['--disable-web-security', '--disable-features=IsolateOrigins,site-per-process'],
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    colorScheme,
    userAgent:
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
  });

const seed = async (ctx) => {
  await ctx.addInitScript(() => {
    localStorage.setItem(
      'mpp.settings.v1',
      JSON.stringify({
        apiBase: '',
        onboarded: true,
        quality: '320',
        recentSearches: ['周杰伦', '晴天'],
        lastPlayed: null,
        showLyricTranslation: false,
        startupVolume: 1,
      }),
    );
  });
};

const run = async (ctx, prefix) => {
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') console.log('[console]', m.text().slice(0, 160));
  });
  const shot = async (name) => {
    await page.screenshot({ path: path.join(OUT, `${prefix}-${name}.png`) });
    console.log('saved', `${prefix}-${name}`);
  };
  const go = async (route, wait = 2600) => {
    await page.goto(`${BASE}/#${route}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(wait);
  };

  await go('/');
  await shot('home');

  const feed = page.locator('.feed-card').first();
  if (await feed.count()) {
    await feed.click();
    await page.waitForTimeout(1800);
    await shot('home-mini');
    const mini = page.locator('.mini .info').first();
    if (await mini.count()) {
      await mini.click();
      await page.waitForTimeout(2600);
      await shot('player');
      await page.locator('.art-shell').first().click();
      await page.waitForTimeout(1600);
      await shot('lyric');
      await page.goto(`${BASE}/#/`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1200);
    }
  }

  await go('/discover');
  await shot('discover');

  await go('/search', 1800);
  const input = page.locator('.search-field input');
  await input.click();
  await input.fill('周杰伦');
  await input.press('Enter');
  await page.waitForTimeout(2400);
  await shot('search');
  const playlistTab = page.locator('.search-tabs .tab', { hasText: '歌单' });
  if (await playlistTab.count()) {
    await playlistTab.click();
    await page.waitForTimeout(2000);
    await shot('search-playlist');
  }

  await go('/mine');
  await shot('mine');
  await go('/settings');
  await shot('settings');
  await go('/login', 2800);
  await shot('login');
  await page.locator('.auth-tab', { hasText: '验证码登录' }).click();
  await page.waitForTimeout(600);
  const phone = page.locator('.sms-phone input');
  if (await phone.count()) {
    await phone.fill('13800138000');
    await page.waitForTimeout(300);
    await shot('login-sms');
  }

  await go('/playlist/collection_3_1863870844_4_0', 3000);
  await shot('playlist');
  await go('/album/966846', 2800);
  await shot('album');
  await go('/artist/3520', 2800);
  await shot('artist');
  await go('/rank/8888', 2800);
  await shot('rank');
  await go('/ranks', 2400);
  await shot('ranks');

  await page.close();
};

const ctx = await launch('light');
await seed(ctx);
await run(ctx, 'light');
await ctx.close();

const darkCtx = await launch('dark');
await seed(darkCtx);
await run(darkCtx, 'dark');
await darkCtx.close();

// 首次启动欢迎页（清空本地存储）
const fresh = await launch('light');
const fp = await fresh.newPage();
await fp.goto(`${BASE}/#/`, { waitUntil: 'domcontentloaded' });
await fp.waitForTimeout(1600);
await fp.screenshot({ path: path.join(OUT, 'welcome-new.png') });
console.log('saved welcome-new');
await fresh.close();
