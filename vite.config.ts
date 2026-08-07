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

// MIT asks that the copyright notice travel with every copy of the software.
// The LICENSE file covers whoever clones the repository; it says nothing to
// whoever copies the built `dist/` onto their own hosting, because the build
// strips every source comment. This puts the notice back into the JavaScript
// the site actually serves.
//
// Two decisions inside a two-line plugin:
//
//   - `generateBundle` rather than `rollupOptions.output.banner`. The banner is
//     applied before Vite minifies, and Vite runs esbuild with
//     `legalComments: 'none'`, which drops even a `/*!` legal comment. This hook
//     runs after every `renderChunk`, so nothing can strip it afterwards.
//   - entry chunks only. One notice per page satisfies the licence; stamping the
//     shared chunks as well would repeat it three times for nobody's benefit,
//     and the text barely compresses — it is close to its own weight in gzip.
// The URL keeps the old repository name until the repository itself is renamed;
// GitHub redirects it permanently either way, so this line is correct before
// and after. See _Name_ in the README.
const NOTICE =
  '/*! Zou | MIT | Copyright (c) 2026 Thibaut Etienne | https://github.com/tetienne/qr-school */';

const legalNotice = (): Plugin => ({
  name: 'legal-notice',
  apply: 'build',
  generateBundle: (_options, bundle) => {
    for (const chunk of Object.values(bundle)) {
      if (chunk.type === 'chunk' && chunk.isEntry) chunk.code = `${NOTICE}\n${chunk.code}`;
    }
  },
});

export default defineConfig({
  base,
  plugins: [tailwindcss(), minifyHtml(), legalNotice()],
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
  // The worker is bundled by a build of its own, which does not inherit the
  // plugins above.
  worker: { format: 'es', plugins: () => [legalNotice()] },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
