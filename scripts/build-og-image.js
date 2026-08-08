// Renders scripts/og-card.html into public/og.png, the picture chat apps and
// social networks show instead of a bare link. Run it after editing the card:
//
//   node scripts/build-og-image.js
//
// The result is committed, and this is a script rather than a Vite plugin, for a
// reason that is not the cost of the browser — GitHub's runners ship Chrome. The
// same HTML rendered twice does not give the same bytes: Chrome version, font
// rendering and PNG encoder all move. Redrawing it on every build would drop a
// new binary into the diff of pull requests that never touched the card, which
// changes about once a year.
//
// The label on the card is not drawn: its code, its ink, its tint and its
// mascot come from the modules that print the sheet, so the preview shows what
// a teacher would get rather than an artist's impression of it. That is why the
// script reads TypeScript directly, which needs Node 22.18 or newer.
//
// Set CHROME_PATH to point at a browser the search below does not find.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { DEFAULT_OPTIONS, labelTheme } from '../src/label-theme.ts';
import { qrCodeSvg } from '../src/qr-generation.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const card = join(root, 'scripts', 'og-card.html');
const output = join(root, 'public', 'og.png');

// The @font-face rules of the card reach into ../node_modules, so the filled-in
// copy has to sit in the same folder as the card itself.
const filled = join(root, 'scripts', 'og-card.filled.html');

// The first name the home page pins beside its title.
const SAMPLE_NAME = 'Léa';

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

const theme = labelTheme(SAMPLE_NAME, DEFAULT_OPTIONS);

writeFileSync(
  filled,
  readFileSync(card, 'utf8')
    .replace('%QR%', qrCodeSvg(SAMPLE_NAME))
    .replace('%INK%', theme.ink)
    .replace('%TINT%', theme.tint)
    .replace('%MASCOT%', theme.mascot)
    .replace('%NAME%', SAMPLE_NAME),
);

try {
  execFileSync(
    findChrome(),
    [
      '--headless=new',
      '--no-sandbox',
      '--disable-gpu',
      '--hide-scrollbars',
      // The card asks for the site's own faces from node_modules. A page opened
      // over file:// gets an opaque origin, so without this every @font-face is
      // refused and the preview comes out in the system stack the design exists
      // to replace.
      '--allow-file-access-from-files',
      // Without it a HiDPI screen renders the card at twice the size it declares.
      '--force-device-scale-factor=1',
      `--window-size=${WIDTH},${HEIGHT}`,
      `--screenshot=${output}`,
      `file://${filled}`,
    ],
    { stdio: ['ignore', 'ignore', 'inherit'] },
  );
} finally {
  rmSync(filled, { force: true });
}

console.log(`${output} — ${WIDTH} × ${HEIGHT}`);
