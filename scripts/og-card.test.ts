// The social preview is a committed PNG: nothing regenerates it, so nothing
// tells anyone it has gone stale. These two tests are that warning.

import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { prepareZXingModule } from 'zxing-wasm/reader';
import { decodeQrCode } from '../src/qr-decoding';

const card = readFileSync(new URL('./og-card.html', import.meta.url), 'utf8');
const stylesheet = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');

describe('the committed preview', () => {
  beforeAll(async () => {
    // Nothing to download under Node: hand the binary over directly.
    const wasmBinary = readFileSync(
      new URL('../node_modules/zxing-wasm/dist/reader/zxing_reader.wasm', import.meta.url),
    );
    await prepareZXingModule({ overrides: { wasmBinary }, fireImmediately: true });
  });

  // The claim the picture makes is that this is a label, not a picture of one.
  // A palette that stops being read, or a render that silently drew nothing,
  // both land here.
  it('carries a label the decoder still reads', async () => {
    const png = readFileSync(new URL('../public/og.png', import.meta.url));
    expect(await decodeQrCode(new Blob([png]))).toBe('Léa');
  });
});

// The card is rendered on its own, from disk, with no Tailwind: its colours are
// copies of the theme rather than references to it. Whoever edits the palette
// edits style.css and will never open this file, so the divergence is caught
// from the other side.
it('is drawn in colours the theme still has', () => {
  const inks = new Set(card.match(/#[0-9a-f]{6}/gi)?.map((ink) => ink.toLowerCase()));
  const known = new Set(stylesheet.match(/#[0-9a-f]{6}/gi)?.map((ink) => ink.toLowerCase()));
  expect([...inks].filter((ink) => !known.has(ink))).toEqual([]);
});
