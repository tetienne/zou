import { defineConfig } from 'vitest/config';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'node:path';

// Sur GitHub Pages, le site est servi sous /<nom-du-depot>/.
// La CI passe VITE_BASE ; en local on reste à la racine.
const base = process.env.VITE_BASE ?? '/';

export default defineConfig({
  base,
  plugins: [tailwindcss()],
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        accueil: resolve(import.meta.dirname, 'index.html'),
        etiquettes: resolve(import.meta.dirname, 'etiquettes.html'),
        photos: resolve(import.meta.dirname, 'photos.html'),
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
