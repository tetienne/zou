import { defineConfig } from 'vitest/config';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'node:path';

// GitHub Pages serves the site under /<repository-name>/.
// The CI passes VITE_BASE; locally we stay at the root.
const base = process.env.VITE_BASE ?? '/';

export default defineConfig({
  base,
  plugins: [tailwindcss()],
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        home: resolve(import.meta.dirname, 'index.html'),
        labels: resolve(import.meta.dirname, 'labels.html'),
        photos: resolve(import.meta.dirname, 'photos.html'),
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
