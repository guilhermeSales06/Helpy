import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Where `/api` is forwarded in dev and preview. Override with VITE_API_TARGET
// (e.g. when port 3000 is taken, or for the e2e run).
const apiProxy = {
  '/api': {
    target: process.env.VITE_API_TARGET ?? 'http://localhost:3000',
    changeOrigin: true,
  },
};

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { proxy: apiProxy },
  preview: { proxy: apiProxy },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
