// 短信登录页视觉检查（不点击发送验证码，避免真实发短信）
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const OUT = path.resolve('.shots');
if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });
const EDGE = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
].find((p) => existsSync(p));

const ctx = await chromium.launchPersistentContext(path.join(OUT, 'edge-sms-profile'), {
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
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
page.on('console', (m) => {
  if (m.type() === 'error') console.log('[console]', m.text().slice(0, 200));
});

const BASE = process.env.BASE_URL || 'http://127.0.0.1:4173';
await page.goto(`${BASE}/#/login`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2400);
await page.screenshot({ path: path.join(OUT, 'login-qr.png') });
console.log('saved login-qr');

await page.locator('.auth-tab', { hasText: '验证码登录' }).click();
await page.waitForTimeout(700);
const phone = page.locator('.sms-phone input');
await phone.click();
await phone.fill('13800138000');
await page.waitForTimeout(400);
await page.screenshot({ path: path.join(OUT, 'login-sms.png') });
console.log('saved login-sms');

// 观察错误提示：输入错体验证码点击登录（会真实请求，但不会发短信）
await page.locator('.sms-form .field input').last().fill('000000');
await page.locator('.sms-form .btn-primary').click();
await page.waitForTimeout(2600);
await page.screenshot({ path: path.join(OUT, 'login-sms-error.png') });
console.log('saved login-sms-error');

await ctx.close();
