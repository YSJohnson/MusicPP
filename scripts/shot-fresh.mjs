// 冷启动验证：清空存储后应直接进入首页（不再有引导页）
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

const ctx = await chromium.launchPersistentContext(path.join(OUT, 'edge-fresh'), {
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

const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(`${BASE}/#/`, { waitUntil: 'domcontentloaded' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3000);

const hasSetup = await page.locator('.setup').count();
const hasStartBtn = await page.getByText('直接开始').count();
console.log('直接开始 button:', hasStartBtn);
console.log('onboarding elements:', hasSetup);
await page.screenshot({ path: path.join(OUT, 'fresh-launch.png') });
console.log('saved fresh-launch');

// 登录页两种方式仍在
await page.goto(`${BASE}/#/login`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);
console.log('tabs:', await page.locator('.auth-tab').count());
await ctx.close();
