import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset paths, so the built game works from any folder or host
  base: './',
  build: { chunkSizeWarningLimit: 1200 },
});
