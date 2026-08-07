// Renders scripts/og-card.html into public/og.png, the picture chat apps and
// social networks show instead of a bare link. Run it after editing the card:
//
//   node scripts/build-og-image.js
//
// The result is committed, and this is a script rather than a Vite plugin, for a
// reason that is not the cost of the browser — GitHub's runners ship Chrome. The
// same HTML rendered twice does not give the same bytes: Chrome version, font
// rendering and PNG encoder all move. Redrawing it on every build would drop a
// new 54 kB binary into the diff of pull requests that never touched the card,
// which changes about once a year.
//
// Set CHROME_PATH to point at a browser the search below does not find.

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
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
