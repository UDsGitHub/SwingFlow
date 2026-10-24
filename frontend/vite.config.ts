import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: Number(process.env.VITE_PORT ?? 5173),
    strictPort: true,
    proxy: {
      '/api': {
        // Overridable so e2e runs can point at an isolated backend.
        target: process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
