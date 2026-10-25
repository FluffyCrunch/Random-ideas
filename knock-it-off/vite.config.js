import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset paths, so the built game works from any folder or host
  base: './',
  build: {
    chunkSizeWarningLimit: 1200,
    sourcemap: false,   // never publish source maps: they would hand out the original code
    rollupOptions: {
      output: {
        // Keep the open-source libraries (Three.js, cannon-es) in their own file, so the
        // scrambling step only has to touch the game's own code
        manualChunks(id) {
          if (id.includes('node_modules')) return 'vendor';
        },
      },
    },
  },
});
