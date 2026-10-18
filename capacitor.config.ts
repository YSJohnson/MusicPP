import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.musicpp.app',
  appName: 'MusicPP',
  webDir: 'dist',
  android: {
    // 音频与封面都来自 http CDN，允许混合内容与明文流量
    allowMixedContent: true,
    backgroundColor: '#07070b',
    // Android 15 强制 edge-to-edge：让 Capacitor 自动给 WebView 加系统栏边距，
    // 避免内容被状态栏 / 手势条遮挡（老系统上不生效，系统本身也不会强制）
    adjustMarginsForEdgeToEdge: 'auto',
  },
  server: {
    // 使用 http://localhost，避免 https 页面被浏览器拦截 http 资源
    androidScheme: 'http',
    cleartext: true,
  },
};

export default config;
