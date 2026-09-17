/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@nexus-ways/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
    },
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/auth': { target: 'http://localhost:4000', changeOrigin: true },
      '/health': { target: 'http://localhost:4000', changeOrigin: true },
      '/ai': { target: 'http://localhost:4000', changeOrigin: true },
      '/trips': { target: 'http://localhost:4000', changeOrigin: true },
      '/vehicles': { target: 'http://localhost:4000', changeOrigin: true },
      '/drivers': { target: 'http://localhost:4000', changeOrigin: true },
      '/geofences': { target: 'http://localhost:4000', changeOrigin: true },
      '/convoys': { target: 'http://localhost:4000', changeOrigin: true },
      '/dashboard': { target: 'http://localhost:4000', changeOrigin: true },
      '/notifications': { target: 'http://localhost:4000', changeOrigin: true },
      '/routing': { target: 'http://localhost:4000', changeOrigin: true },
      '/geocoding': { target: 'http://localhost:4000', changeOrigin: true },
      '/stations': { target: 'http://localhost:4000', changeOrigin: true },
      '/trains': { target: 'http://localhost:4000', changeOrigin: true },
      '/locomotives': { target: 'http://localhost:4000', changeOrigin: true },
      '/rakes': { target: 'http://localhost:4000', changeOrigin: true },
      '/loco-pilots': { target: 'http://localhost:4000', changeOrigin: true },
      '/train-movements': { target: 'http://localhost:4000', changeOrigin: true },
      '/airports': { target: 'http://localhost:4000', changeOrigin: true },
      '/aircraft': { target: 'http://localhost:4000', changeOrigin: true },
      '/flight-crew': { target: 'http://localhost:4000', changeOrigin: true },
      '/flights': { target: 'http://localhost:4000', changeOrigin: true },
      '/platform': { target: 'http://localhost:4000', changeOrigin: true },
      '/vessels': { target: 'http://localhost:4000', changeOrigin: true },
      '/ports': { target: 'http://localhost:4000', changeOrigin: true },
      '/sea-crew': { target: 'http://localhost:4000', changeOrigin: true },
      '/voyages': { target: 'http://localhost:4000', changeOrigin: true },
      '/voyage-movements': { target: 'http://localhost:4000', changeOrigin: true },
      '/sea-convoys': { target: 'http://localhost:4000', changeOrigin: true },
      '/admin': { target: 'http://localhost:4000', changeOrigin: true },
      '/socket.io': { target: 'http://localhost:4000', ws: true, changeOrigin: true },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
});
