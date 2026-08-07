import { defineConfig } from 'vitest/config';
import type { HtmlTagDescriptor, Plugin } from 'vite';
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
const UPSTREAM = 'https://github.com/tetienne/zou';

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

// The address the site is served from. Three of the tags below have to carry an
// absolute one — the canonical link, `og:url`, `og:image` — and a wrong absolute
// address is worse than none at all: a canonical pointing at somebody else's
// copy asks the search engine to index that copy *instead of* this one. So it is
// derived from the CI environment, and when it cannot be derived — `npm run dev`,
// a local build — those three tags are simply not emitted. Everything else on
// the page is unaffected.
//
// GitHub Pages serves a project page at `https://<owner>.github.io/<repo>/` with
// the owner lower-cased, and the repository named `<owner>.github.io` at the
// root instead. `SITE_URL` overrides the derivation, which is what a custom
// domain (a `CNAME` file) needs.
const siteUrl = ((): string | undefined => {
  const { SITE_URL } = process.env;
  if (SITE_URL) return SITE_URL.endsWith('/') ? SITE_URL : `${SITE_URL}/`;
  // Only github.com has github.io; a GitHub Enterprise Pages address does not
  // follow from the environment, so it is left to SITE_URL.
  if (!GITHUB_REPOSITORY || (GITHUB_SERVER_URL ?? 'https://github.com') !== 'https://github.com')
    return undefined;
  const [owner, repository] = GITHUB_REPOSITORY.toLowerCase().split('/');
  if (!owner || !repository) return undefined;
  const host = `https://${owner}.github.io/`;
  return repository === `${owner}.github.io` ? host : `${host}${repository}/`;
})();

// The pages a search engine is told about, in the order a reader meets them.
const PAGES = ['index.html', 'labels.html', 'photos.html'] as const;

const addressOf = (page: string): string => `${siteUrl ?? '/'}${page === 'index.html' ? '' : page}`;

// The social preview, 1200 × 630 in `public/`. Regenerate with
// `node scripts/build-og-image.js` after changing what the site says it does.
// Its description is French like the rest of what a reader is shown: a screen
// reader announces it to whoever meets the link in a group chat.
const OG_IMAGE = {
  file: 'og.png',
  width: '1200',
  height: '630',
  alt: "Le carré bleu de Zou, à côté de la phrase « Ranger les photos des travaux d'élèves ».",
};

const firstMatch = (html: string, pattern: RegExp, what: string, page: string): string => {
  const found = pattern.exec(html)?.[1];
  if (!found) throw new Error(`${page} has no ${what}, and the social tags are built from it.`);
  return found;
};

// A page carries its `<title>` and its description, in French, where whoever
// edits the page can read them. Everything else a search engine or a chat app
// wants is a rearrangement of those two, so it is generated rather than written
// out three times per page and drifting from the first copy at the first edit.
//
// The build fails on a page missing either one, because the failure it replaces
// is silent: a link shared into a staff-room group chat that unfurls as a bare
// URL, which nobody notices until months later.
const seoTags = (): Plugin => ({
  name: 'seo-tags',
  // No `apply`: emitting them in dev too is what makes them checkable by hand.
  transformIndexHtml: {
    // Before minifyHtml, which runs 'post'.
    order: 'pre',
    handler: (html, ctx) => {
      // '/labels.html' during a build, and '/' for the home page in dev.
      const file = ctx.path.split('/').pop();
      const page = file === undefined || file === '' ? 'index.html' : file;
      const title = firstMatch(html, /<title>([\s\S]*?)<\/title>/, 'a <title>', page);
      const description = firstMatch(
        html,
        /<meta\b[^>]*\bname="description"[^>]*\bcontent="([^"]*)"/,
        'a description',
        page,
      );

      const meta = (attrs: Record<string, string>): HtmlTagDescriptor => ({
        tag: 'meta',
        attrs,
        injectTo: 'head',
      });
      const tags: HtmlTagDescriptor[] = [
        meta({ property: 'og:type', content: 'website' }),
        meta({ property: 'og:site_name', content: 'Zou' }),
        meta({ property: 'og:locale', content: 'fr_FR' }),
        meta({ property: 'og:title', content: title }),
        meta({ property: 'og:description', content: description }),
        // The large card, rather than the thumbnail beside a line of text.
        meta({ name: 'twitter:card', content: 'summary_large_image' }),
      ];

      if (siteUrl) {
        const address = addressOf(page);
        tags.push(
          { tag: 'link', attrs: { rel: 'canonical', href: address }, injectTo: 'head' },
          meta({ property: 'og:url', content: address }),
          meta({ property: 'og:image', content: `${siteUrl}${OG_IMAGE.file}` }),
          meta({ property: 'og:image:width', content: OG_IMAGE.width }),
          meta({ property: 'og:image:height', content: OG_IMAGE.height }),
          meta({ property: 'og:image:alt', content: OG_IMAGE.alt }),
        );
      }

      // On the home page only: what the site is, in the form an engine parses
      // rather than reads. Built from the same title and description, so there
      // is still one copy of each.
      if (page === 'index.html') {
        tags.push({
          tag: 'script',
          attrs: { type: 'application/ld+json' },
          children: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebApplication',
            name: 'Zou',
            description,
            ...(siteUrl ? { url: addressOf(page) } : {}),
            applicationCategory: 'EducationalApplication',
            operatingSystem: 'Windows, macOS, Linux, ChromeOS',
            inLanguage: 'fr',
            isAccessibleForFree: true,
            offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
            license: 'https://opensource.org/licenses/MIT',
          }),
          injectTo: 'head',
        });
      }

      return { html, tags };
    },
  },

  // A sitemap is worth its three lines here for one reason: it is the thing
  // Search Console accepts for a site living under a path rather than at a
  // domain of its own. `robots.txt` deliberately has no counterpart — a crawler
  // only ever reads the one at the root of the host, which for a GitHub Pages
  // project page belongs to another repository entirely.
  //
  // No `lastmod`, no `changefreq`, no `priority`: Google ignores the last two
  // outright, and a `lastmod` stamped at every deploy would claim the label
  // sheet changed because a colour in the stylesheet did.
  generateBundle() {
    if (!siteUrl) return;
    const urls = PAGES.map((page) => `  <url><loc>${addressOf(page)}</loc></url>`).join('\n');
    this.emitFile({
      type: 'asset',
      fileName: 'sitemap.xml',
      source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
    });
  },
});

export default defineConfig({
  base,
  plugins: [tailwindcss(), sourceLink(), seoTags(), minifyHtml(), legalNotice()],
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
