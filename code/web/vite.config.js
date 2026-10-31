import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite 配置：开发端口 5173，/api 代理到后端 3000 端口
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: false
  }
});
