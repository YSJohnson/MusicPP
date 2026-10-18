import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    watch: {
      // 忽略临时文件目录（原子写入产生的 .tmpdir）与参考资料目录，避免 Windows 下的 EBUSY
      ignored: ['**/*.tmpdir/**', '**/*.tmp', '**/_ref/**', '**/android/**'],
    },
  },
  build: {
    outDir: 'dist',
    target: 'es2019',
    cssCodeSplit: false,
    chunkSizeWarningLimit: 1200,
  },
});
