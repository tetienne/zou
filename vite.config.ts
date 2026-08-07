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
// The address below is attribution, not provenance: it names the author's
// repository, so it stays put even in a fork's own build, and it survives a
// rename through GitHub's permanent redirect. That is the opposite of the footer
// link a few lines down — same URL today, two different questions.
const UPSTREAM = 'https://github.com/tetienne/qr-school';

const NOTICE = `/*! Zou | MIT | Copyright (c) 2026 Thibaut Etienne | ${UPSTREAM} */`;

const legalNotice = (): Plugin => ({
  name: 'legal-notice',
  apply: 'build',
  generateBundle: (_options, bundle) => {
    for (const chunk of Object.values(bundle)) {
      if (chunk.type === 'chunk' && chunk.isEntry) chunk.code = `${NOTICE}\n${chunk.code}`;
    }
  },
});

// The footer link answers "where does the page I am looking at come from?", so
// it is built rather than written down. GitHub Actions sets GITHUB_REPOSITORY and
// GITHUB_SERVER_URL for every step of every job, which buys two things for free:
// renaming the repository moves the link with it, and a fork's pages point at the
// fork instead of crediting this repository for someone else's changes.
//
// Not Vite's own `%VITE_*%` substitution, which reads `.env` files: this value
// comes from the CI environment, and an unset variable would be served to the
// teacher as a literal `%VITE_SOURCE_URL%` in an `href`. Falling back to UPSTREAM
// keeps `npm run dev` and a local build clickable.
const { GITHUB_SERVER_URL, GITHUB_REPOSITORY } = process.env;
const sourceUrl = GITHUB_REPOSITORY
  ? `${GITHUB_SERVER_URL ?? 'https://github.com'}/${GITHUB_REPOSITORY}`
  : UPSTREAM;

const sourceLink = (): Plugin => ({
  name: 'source-link',
  // No `apply`: the dev server needs the substitution too.
  transformIndexHtml: {
    // Before minifyHtml, which runs 'post'.
    order: 'pre',
    handler: (html) => html.replaceAll('%SOURCE_URL%', sourceUrl),
  },
});

export default defineConfig({
  base,
  plugins: [tailwindcss(), sourceLink(), minifyHtml(), legalNotice()],
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
