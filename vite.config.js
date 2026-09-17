import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/ws': { target: 'http://127.0.0.1:3001', ws: true },
      '/api/ws': { target: 'http://127.0.0.1:3001', ws: true },
      '/health': 'http://127.0.0.1:3001',
    },
  },
  build: {
    chunkSizeWarningLimit: 850,
    rollupOptions: { output: { manualChunks: id => id.includes('node_modules/three/') ? 'three' : id.includes('node_modules') ? 'framework' : undefined } },
  },
});
