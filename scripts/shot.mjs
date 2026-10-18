// 使用系统 Edge 进行移动端视口截图（开发辅助脚本，不参与打包）
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const OUT = path.resolve('.shots');
if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE_URL || '${BASE}';

const EDGE_CANDIDATES = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
];

const args = process.argv.slice(2);
const targets = args.length
  ? args
  : ['/#/', '/#/discover', '/#/search', '/#/mine'];

const executablePath = EDGE_CANDIDATES.find((p) => existsSync(p));
if (!executablePath) {
  console.error('未找到 Edge，可改用 channel: "msedge"');
  process.exit(1);
}

const browser = await chromium.launch({ executablePath, headless: true });
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
  if (m.type() === 'error') console.log('[console]', m.text().slice(0, 300));
});

for (const target of targets) {
  const [route, name] = target.includes('::') ? target.split('::') : [target, null];
  const file = name || route.replace(/[#/]+/g, '_').replace(/^_/, '') || 'index';
  await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2200);
  await page.screenshot({ path: path.join(OUT, `${file}.png`) });
  console.log('saved', path.join(OUT, `${file}.png`));
}

await browser.close();

