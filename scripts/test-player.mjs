// 离线浏览器回归：真实音频时钟、逐帧进度、触摸选词、变高歌词与首尾定位。
import assert from 'node:assert/strict';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const temp = path.resolve('.tmp/player-test');
mkdirSync(temp, { recursive: true });
process.env.TEMP = temp;
process.env.TMP = temp;
const { createServer } = await import('vite');
const executablePath = process.env.BROWSER_PATH || [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
].find(existsSync);
assert.ok(executablePath, '设置 BROWSER_PATH 为 Chromium/Edge 可执行文件路径');

const fixture = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body><div id="fixture"></div><script>
const nativeFrame = window.requestAnimationFrame.bind(window);
const nativeCancelFrame = window.cancelAnimationFrame.bind(window);
window.pendingFrames = new Set();
window.requestAnimationFrame = callback => {
  const id = nativeFrame(time => { pendingFrames.delete(id); callback(time); });
  pendingFrames.add(id);
  return id;
};
window.cancelAnimationFrame = id => { pendingFrames.delete(id); nativeCancelFrame(id); };
window.Audio = class extends Audio {
  constructor() {
    super();
    window.testAudio = this;
    this.addEventListener('timeupdate', e => {
      if (window.suppressTimeupdate) e.stopImmediatePropagation();
    }, true);
  }
};
</script><script type="module">
import React, { Profiler } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { LyricView } from '/src/components/LyricView.tsx';
import { ProgressBar } from '/src/components/ProgressBar.tsx';
import { HomePage } from '/src/pages/Home.tsx';
import { PlayerPage } from '/src/pages/Player.tsx';
import { parseSongClimax, parseSongQualities } from '/src/api/normalize.ts';
import { usePlayer } from '/src/store/player.ts';
import { useSettings } from '/src/store/settings.ts';
import '/src/styles/base.css';
import '/src/styles/shell.css';
import '/src/styles/pages.css';
import '/src/styles/player.css';
import '/src/styles/extra.css';
const h = React.createElement;
const root = createRoot(document.getElementById('fixture'));
const lines = Array.from({ length: 160 }, (_, i) => {
  const text = i % 7 === 3 ? 'A longer lyric with spaces that wraps naturally onto several lines' : '让每一句歌词跟随音乐流动';
  const words = [...text].map((text, j, all) => ({ text, time: i * 4000 + j * 4000 / all.length, dur: 4000 / all.length }));
  return { time: i * 4000, dur: 4000, text, words };
});
const lyric = { krc: true, lines };
const commits = { lyric: 0, progress: 0 };
let stageClicks = 0;
const seek = time => { usePlayer.getState().seek(time); window.lastSeek = time; };
window.test = { usePlayer, lines, commits, parseSongClimax, parseSongQualities, get stageClicks() { return stageClicks; },
  render(align = 'center', data = lyric) {
    root.render(h('div', { style: { padding: '24px', background: '#252b35', color: 'white' } },
      h('div', { className: 'fixture-stage', onClick: () => stageClicks++, style: { height: '410px', display: 'flex' } },
        h(Profiler, { id: 'lyric', onRender: () => commits.lyric++ }, h(LyricView, { lyric: data, loading: false, align, onSeek: seek }))),
      h(Profiler, { id: 'progress', onRender: () => commits.progress++ }, h(ProgressBar, { duration: 640, onSeek: seek }))));
  },
  home() {
    const song = { hash: 'fixture', name: '测试歌曲', artist: '测试歌手', duration: 640 };
    useSettings.getState().setLastPlayed({ song, queue: [song], index: 0, time: 12, at: Date.now() });
    root.render(h(MemoryRouter, null, h(HomePage)));
  },
  player(hash = 'alpha') {
    const song = { key: hash, hash, name: '多远都要在一起', artist: 'G.E.M. 邓紫棋', album: '', duration: 640, vip: true, source: 'search' };
    useSettings.getState().setApiBase(location.origin);
    usePlayer.setState({ queue: [song], index: 0, lyric, lyricHash: hash, lyricLoading: false, duration: 640,
      setQuality: async quality => { usePlayer.setState({ quality }); window.lastQuality = quality; } });
    root.render(h(MemoryRouter, null, h(PlayerPage)));
  },
  unmount() { root.unmount(); }
};
// 本地静音 WAV，无接口、账号或网络依赖；由浏览器真实推进 currentTime。
const wav = new Uint8Array(44 + 8000 * 640).fill(128);
const view = new DataView(wav.buffer);
const str = (offset, text) => [...text].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
str(0, 'RIFF'); view.setUint32(4, wav.length - 8, true); str(8, 'WAVEfmt ');
view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
view.setUint32(24, 8000, true); view.setUint32(28, 8000, true); view.setUint16(32, 1, true); view.setUint16(34, 8, true);
str(36, 'data'); view.setUint32(40, wav.length - 44, true);
testAudio.src = URL.createObjectURL(new Blob([wav], { type: 'audio/wav' }));
await new Promise(resolve => testAudio.addEventListener('loadedmetadata', resolve, { once: true }));
window.test.render();
window.testReady = true;
</script></body></html>`;

const fixtureScript = fixture.match(/<script type="module">([\s\S]*?)<\/script>/)[1];
const fixtureHtml = fixture.replace(/<script type="module">[\s\S]*?<\/script>/,
  '<script type="module" src="/__test/player-fixture.tsx"></script>');

const server = await createServer({
  server: { host: '127.0.0.1', port: 5183, strictPort: true, open: false },
  plugins: [{
    name: 'player-regression-fixture',
    resolveId(id) {
      if (id === '/__test/player-fixture.tsx') return '\0player-fixture';
    },
    load(id) {
      if (id === '\0player-fixture') return fixtureScript;
    },
    configureServer(dev) {
      dev.middlewares.use(async (req, res, next) => {
        if (req.url !== '/__test/player') return next();
        try {
          res.setHeader('Content-Type', 'text/html');
          res.end(await dev.transformIndexHtml('/__test/player', fixtureHtml));
        } catch (error) { next(error); }
      });
    },
  }],
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ executablePath, headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/song/climax') {
      const hash = url.searchParams.get('hash');
      const respond = () => route.fulfill({ json: { status: 1, data: hash === 'empty' ? [] : [{ hash, start_time: '84170', end_time: '142170' }] } });
      return hash === 'slow' ? new Promise(resolve => setTimeout(resolve, 350)).then(respond) : respond();
    }
    if (url.pathname === '/privilege/lite') return route.fulfill({ json: { quality_vip: [{
      hash: url.searchParams.get('hash'), qualities: [
        { quality: '128', obtainable: true, need_vip: false, size_text: '2.4M' },
        { quality: '320', obtainable: true, need_vip: true, size_text: '8.2M' },
        { quality: 'flac', obtainable: true, need_vip: true, size_text: '22.9M' },
      ],
    }] } });
    if (url.hostname === '127.0.0.1' && url.port === '5183') return route.continue();
    return route.abort();
  });
  await page.goto('http://127.0.0.1:5183/__test/player');
  await page.waitForFunction(() => window.testReady);
  await page.locator('.lyric-line').first().waitFor();
  const centerError = () => page.evaluate(() => {
    const box = document.querySelector('.lyric-scroll').getBoundingClientRect();
    const active = document.querySelector('.lyric-line.active');
    const row = active.getBoundingClientRect();
    const next = active.nextElementSibling?.getBoundingClientRect();
    const index = [...document.querySelectorAll('.lyric-line')].indexOf(active);
    const progress = next ? Math.max(0, Math.min(1, (testAudio.currentTime - index * 4) / 4)) : 0;
    const center = row.y + row.height / 2;
    return Math.abs(center + (next ? next.y + next.height / 2 - center : 0) * progress - (box.y + box.height / 2));
  });
  assert.ok(await centerError() < 2, '首行应能居中');

  const animation = await page.evaluate(async () => {
    window.suppressTimeupdate = true;
    await testAudio.play();
    const before = { ...test.commits };
    const storeTime = test.usePlayer.getState().time;
    const samples = [];
    const until = performance.now() + 500;
    while (performance.now() < until) {
      await new Promise(requestAnimationFrame);
      samples.push({ word: document.querySelector('.lyric-line.active .w').style.getPropertyValue('--p'),
        fill: document.querySelector('.fill').style.transform, rowY: document.querySelector('.lyric-line').getBoundingClientRect().y });
    }
    testAudio.pause();
    return { wordFrames: new Set(samples.map(s => s.word)).size, progressFrames: new Set(samples.map(s => s.fill)).size,
      scrollFrames: new Set(samples.map(s => s.rowY)).size,
      lyricCommits: test.commits.lyric - before.lyric, storeUnchanged: storeTime === test.usePlayer.getState().time };
  });
  assert.ok(animation.wordFrames >= 8 && animation.progressFrames >= 8 && animation.scrollFrames >= 8, JSON.stringify(animation));
  assert.ok(animation.lyricCommits <= 2 && animation.storeUnchanged, '逐帧更新不应重绘整页或更新全局进度');
  console.log('PASS 真实音频时钟逐帧更新，低频 timeupdate 被屏蔽时仍流畅', animation);
  const paused = await page.locator('.fill').evaluate(el => el.style.transform);
  await page.waitForTimeout(120);
  assert.equal(await page.locator('.fill').evaluate(el => el.style.transform), paused, '暂停后进度应停止');

  await page.evaluate(async () => {
    await testAudio.play();
    test.usePlayer.setState({ buffering: true });
  });
  const buffered = await page.locator('.fill').evaluate(el => el.style.transform);
  await page.waitForTimeout(150);
  assert.equal(await page.locator('.fill').evaluate(el => el.style.transform), buffered, '缓冲时应停止动画');
  await page.evaluate(() => test.usePlayer.setState({ buffering: false }));
  await page.waitForTimeout(80);
  assert.notEqual(await page.locator('.fill').evaluate(el => el.style.transform), buffered, '缓冲结束应按音频时钟恢复');
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  const hidden = await page.locator('.fill').evaluate(el => el.style.transform);
  await page.waitForTimeout(100);
  assert.equal(await page.locator('.fill').evaluate(el => el.style.transform), hidden, '后台应停止动画');
  await page.evaluate(() => {
    delete document.hidden;
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForTimeout(80);
  assert.notEqual(await page.locator('.fill').evaluate(el => el.style.transform), hidden, '回到前台应同步实际音频时间');
  await page.evaluate(() => testAudio.pause());
  assert.equal(await page.evaluate(() => pendingFrames.size), 0, '暂停后应清理所有动画帧');
  console.log('PASS 暂停、缓冲、后台停止动画，恢复后同步真实进度');

  await page.evaluate(() => { window.suppressTimeupdate = false; test.usePlayer.getState().seek(60.2); });
  await page.waitForTimeout(500);
  assert.ok(await centerError() < 2, '多行歌词在跳转后应居中');
  const beforeHeights = await page.locator('.lyric-line').evaluateAll(rows => rows.map(el => el.offsetHeight));
  await page.evaluate(() => test.usePlayer.getState().seek(64.2));
  await page.waitForTimeout(500);
  assert.deepEqual(await page.locator('.lyric-line').evaluateAll(rows => rows.map(el => el.offsetHeight)), beforeHeights, '高亮切换不能改变歌词布局');

  const cdp = await page.context().newCDPSession(page);
  const touch = (type, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' || type === 'touchCancel' ? [] : [{ x: 195, y }] });
  const drag = async (distance, cancel = false) => {
    await touch('touchStart', 245);
    for (let step = 1; step <= 12; step++) {
      await touch('touchMove', 245 - distance * step / 12);
      await page.evaluate(() => new Promise(requestAnimationFrame));
    }
    if (cancel) await touch('touchCancel');
  };
  const alignment = () => page.evaluate(() => {
    const row = document.querySelector('.seek-target').getBoundingClientRect();
    const bar = document.querySelector('.lyric-seekbar').getBoundingClientRect();
    const line = document.querySelector('.lyric-seekline').getBoundingClientRect();
    const box = document.querySelector('.lyric-scroll').getBoundingClientRect();
    const middle = box.y + box.height / 2;
    return { error: Math.max(Math.abs(middle - (bar.y + bar.height / 2)), Math.abs(middle - (line.y + line.height / 2))),
      index: [...document.querySelectorAll('.lyric-line')].indexOf(document.querySelector('.seek-target')), top: bar.y, rowY: row.y };
  });
  await drag(96);
  let selected = await alignment();
  assert.ok(selected.error < 2, `指示条应固定在视口中心：${JSON.stringify(selected)}`);
  await touch('touchMove', 146);
  await page.evaluate(() => new Promise(requestAnimationFrame));
  const shifted = await alignment();
  assert.equal(selected.index, shifted.index, '小幅移动应保持同一选中行');
  assert.equal(shifted.top, selected.top, '指示线应固定，歌词自由经过');
  assert.ok(Math.abs(shifted.rowY - selected.rowY) > 1, '同一行内也应按手指距离移动，不吸附');
  assert.ok(shifted.error < 2);
  await page.waitForTimeout(100);
  await touch('touchEnd');
  assert.equal(await page.evaluate(() => test.stageClicks), 0, '拖动不能误触封面切换');
  const selectedTime = shifted.index * 4;
  mkdirSync(path.resolve('.shots'), { recursive: true });
  await page.screenshot({ path: '.shots/lyric-drag-regression.png' });
  await page.getByRole('button', { name: '跳转到选中歌词' }).click();
  assert.equal(await page.evaluate(() => window.lastSeek), selectedTime, '点击指示条应跳转到选中行时间');

  await page.waitForTimeout(500);
  await drag(-90, true);
  await page.waitForTimeout(2450);
  assert.equal(await page.locator('.lyric-view.seeking').count(), 0, '取消触摸后也应自动返回');
  assert.ok(await centerError() < 2);
  console.log('PASS 触摸连续拖动、指示条对齐、准确跳转、pointercancel 和超时回位');

  await drag(100);
  await touch('touchEnd');
  const releasedTop = await page.locator('.lyric-scroll').evaluate(el => el.scrollTop);
  await page.waitForTimeout(120);
  assert.ok(await page.locator('.lyric-scroll').evaluate(el => el.scrollTop) > releasedTop + 3, '快速滑动松手后应继续惯性滚动');
  await page.getByRole('button', { name: '跳转到选中歌词' }).click();
  await page.waitForTimeout(400);
  assert.ok(await centerError() < 2, '惯性滚动后仍能跳转到所选时间');
  console.log('PASS 手动滑动有惯性，无逐行吸附');

  await page.evaluate(() => { test.render('left'); test.usePlayer.getState().seek(636); });
  await page.setViewportSize({ width: 430, height: 760 });
  await page.waitForTimeout(550);
  assert.ok(await centerError() < 2, '末行在改对齐和改尺寸后也应居中');
  await drag(50);
  selected = await alignment();
  assert.equal(selected.index, 159);
  assert.ok(selected.error < 2);
  await touch('touchEnd');
  await page.waitForTimeout(2450);

  const bar = await page.locator('.progress-bar').boundingBox();
  await page.mouse.move(bar.x + bar.width / 4, bar.y + bar.height / 2);
  await page.mouse.down();
  await page.mouse.move(bar.x + bar.width * 0.75, bar.y + bar.height / 2);
  await page.mouse.up();
  assert.ok(Math.abs(await page.evaluate(() => window.lastSeek) - 480) < 1, '播放进度条拖动应准确');
  await page.evaluate(() => test.render('left', { krc: false, lines: test.lines.map(({ words, ...line }) => line) }));
  await page.waitForTimeout(150);
  assert.equal(await page.locator('.lyric-line .w').count(), 0, '普通 LRC 歌词应正常显示');
  assert.ok(await centerError() < 2);
  console.log('PASS 首尾行、靠左对齐、视口变化、普通 LRC 和播放进度拖动');

  mkdirSync(path.resolve('.shots'), { recursive: true });
  await page.screenshot({ path: '.shots/player-regression.png' });
  await page.evaluate(async () => { await testAudio.play(); test.home(); });
  await page.locator('.resume-card .play').waitFor();
  assert.equal(await page.evaluate(() => pendingFrames.size), 0, '离开播放器后应清理所有动画帧');
  const iconError = await page.locator('.resume-card .play').evaluate(el => {
    const box = el.getBoundingClientRect();
    const icon = el.querySelector('svg').getBoundingClientRect();
    return Math.max(Math.abs(box.x + box.width / 2 - icon.x - icon.width / 2), Math.abs(box.y + box.height / 2 - icon.y - icon.height / 2));
  });
  assert.ok(iconError < 1, '续播按钮的播放图标应居中');
  await page.screenshot({ path: '.shots/home-resume-regression.png' });
  assert.deepEqual(errors, [], '浏览器不应出现运行错误');
  console.log('PASS 首页续播播放图标居中，无浏览器运行错误');

  await page.evaluate(() => { testAudio.pause(); test.player(); });
  const marker = page.getByRole('button', { name: '高潮起点 1:24' });
  await marker.waitFor();
  const markerRatio = await marker.evaluate(el => {
    const rect = el.getBoundingClientRect();
    const track = el.parentElement.getBoundingClientRect();
    return (rect.x + rect.width / 2 - track.x) / track.width;
  });
  assert.ok(Math.abs(markerRatio - 84.17 / 640) < 0.001, '高潮标记应按真实毫秒时间定位');
  await marker.click();
  assert.ok(Math.abs(await page.evaluate(() => testAudio.currentTime) - 84.17) < 0.05);
  assert.equal(await page.locator('.progress-bar.dragging').count(), 0, '高潮按钮不能误触进度拖动');
  await page.screenshot({ path: '.shots/player-climax.png' });
  await page.getByRole('button', { name: '音质', exact: true }).click();
  await page.locator('.quality-row').first().waitFor();
  await page.locator('.sheet').evaluate(el => Promise.all(el.getAnimations().map(animation => animation.finished)));
  for (const text of ['快捷清晰的音质（2.4M）', '高频细节还原清晰细节（8.2M）', '高保真无损品质，听到最纯正的声音（22.9M）']) {
    assert.equal(await page.getByText(text, { exact: true }).count(), 1);
  }
  assert.ok(await page.locator('.quality-vip-icon').first().evaluate(el => el.complete && el.naturalWidth > 0), '原版 VIP 图标应正确加载');
  const sheetMatchesTheme = () => page.locator('.sheet').evaluate(el => {
    const sample = document.createElement('div');
    sample.style.backgroundColor = 'var(--bg-elevated)';
    document.body.append(sample);
    const matches = getComputedStyle(el).backgroundColor === getComputedStyle(sample).backgroundColor;
    sample.remove();
    return matches;
  });
  assert.ok(await sheetMatchesTheme(), '音质面板应保持项目浅色主题');
  await page.screenshot({ path: '.shots/quality-descriptions-light.png' });
  await page.emulateMedia({ colorScheme: 'dark' });
  assert.ok(await sheetMatchesTheme(), '音质面板应保持项目深色主题');
  await page.screenshot({ path: '.shots/quality-descriptions-dark.png' });
  await page.locator('.quality-row').filter({ hasText: '无损音质' }).click();
  assert.equal(await page.evaluate(() => window.lastQuality), 'flac');
  assert.equal(await page.getByRole('dialog').count(), 0);
  await page.evaluate(() => test.player('slow'));
  await page.evaluate(() => test.player('empty'));
  await page.waitForTimeout(500);
  assert.equal(await page.locator('.climax-marker').count(), 0, '没有高潮信息时不显示标记，旧歌曲的请求结果不能串歌');
  assert.deepEqual(await page.evaluate(() => test.parseSongClimax({ data: [{ hash: 'x', start_time: '84170', end_time: '142170' }] }, 'x')),
    { start: 84.17, end: 142.17 });
  assert.equal(await page.evaluate(() => test.parseSongClimax({ data: [{ hash: 'other', start_time: '84170', end_time: '142170' }] }, 'x')), null);
  assert.deepEqual(errors, []);
  console.log('PASS 高潮标记位置与跳转、缺失数据、切歌隔离，原版音质文案和 VIP 图标，保留深浅主题');
} finally {
  await browser?.close();
  await server.close();
}
