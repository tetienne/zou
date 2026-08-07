// Renders scripts/og-card.html into public/og.png, the picture chat apps and
// social networks show instead of a bare link. Run it after editing the card:
//
//   node scripts/build-og-image.js
//
// The result is committed, so nothing in `npm run build` or in CI depends on a
// browser being installed. That is the whole reason this is a script and not a
// Vite plugin: the preview changes once a year, and paying for a headless
// Chromium on every build — and in every fork's CI — to redraw the same picture
// would be a poor trade.
//
// Set CHROME_PATH to point at a browser the search below does not find.

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const card = join(root, 'scripts', 'og-card.html');
const output = join(root, 'public', 'og.png');

// Kept in step with the `OG_IMAGE` dimensions in vite.config.ts, which is what
// the `og:image:width` and `og:image:height` tags announce.
const WIDTH = 1200;
const HEIGHT = 630;

const findChrome = () => {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;

  const usual = [
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
  ];
  const found = usual.find((path) => existsSync(path));
  if (found) return found;

  // Playwright keeps its browsers in a versioned directory.
  const pool = process.env.PLAYWRIGHT_BROWSERS_PATH ?? '/opt/pw-browsers';
  if (existsSync(pool)) {
    for (const entry of readdirSync(pool)) {
      const path = join(pool, entry, 'chrome-linux', 'chrome');
      if (entry.startsWith('chromium-') && existsSync(path)) return path;
    }
  }

  throw new Error('No Chromium found. Install one, or point CHROME_PATH at it.');
};

execFileSync(
  findChrome(),
  [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--hide-scrollbars',
    // Without it a HiDPI screen renders the card at twice the size it declares.
    '--force-device-scale-factor=1',
    `--window-size=${WIDTH},${HEIGHT}`,
    `--screenshot=${output}`,
    `file://${card}`,
  ],
  { stdio: ['ignore', 'ignore', 'inherit'] },
);

console.log(`${output} — ${WIDTH} × ${HEIGHT}`);
