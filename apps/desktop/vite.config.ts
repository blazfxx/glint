import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Pages load from the app's files, so paths stay relative.
  base: './',
  plugins: [react(), tailwindcss()],
  build: { chunkSizeWarningLimit: 1500 },
  test: { include: ['test/**/*.test.ts'], environment: 'node' },
});
