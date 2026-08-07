import { defineConfig } from 'vitest/config';
import type { Plugin } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { minify } from 'html-minifier-terser';
import { resolve } from 'node:path';

// GitHub Pages serves the site under /<repository-name>/.
// The CI passes VITE_BASE; locally we stay at the root.
const base = process.env.VITE_BASE ?? '/';

// Vite already minifies the JavaScript and the CSS of a production build; it
// ships the HTML as written, indentation and source comments included. Those
// comments explain the markup to whoever edits it, and the teacher's browser
// downloads them on every cold load. This squeezes them out at build time so
// the source stays readable.
//
// Whitespace collapsing is a rendering change, not just a size one: it is safe
// here because no code walks the DOM by sibling or child index, and because
// html-minifier-terser keeps the single space that separates inline elements.
const minifyHtml = (): Plugin => ({
  name: 'minify-html',
  apply: 'build',
  transformIndexHtml: {
    // After Vite has injected the script and stylesheet tags.
    order: 'post',
    handler: (html) =>
      minify(html, {
        collapseWhitespace: true,
        removeComments: true,
        // No page has an inline <style> or <script> today; both stay on so a
        // future one is not silently left unminified.
        minifyCSS: true,
        minifyJS: true,
      }),
  },
});

export default defineConfig({
  base,
  plugins: [tailwindcss(), minifyHtml()],
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
