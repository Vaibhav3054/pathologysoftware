import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  base: './',
  root: '.',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@': path.resolve('.'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/supabase-api': {
        target: 'https://zgudwlzlmroxkrkbmqxl.supabase.co',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/supabase-api/, ''),
      },
    },
  },
});
