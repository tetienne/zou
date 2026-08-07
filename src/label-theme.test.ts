import { describe, expect, it } from 'vitest';
import {
  brightnessOf,
  channelsOf,
  DEFAULT_OPTIONS,
  labelTheme,
  PALETTES,
  readableInk,
  type LabelOptions,
} from './label-theme';

const CLASS = ['Léa', 'Noé', 'Camille', 'Youssef', 'Marie-Claire', 'Tom', 'Zoé', 'Ibrahim'];

/** Brightness of a `#rrggbb` colour, as the decoder perceives it. */
function brightness(colour: string): number {
  return brightnessOf(channelsOf(colour) ?? [0, 0, 0]);
}

function withOptions(options: Partial<LabelOptions>): LabelOptions {
  return { ...DEFAULT_OPTIONS, ...options };
}

describe('labelTheme', () => {
  it('gives the same child the same colour every time', () => {
    expect(labelTheme('Léa', DEFAULT_OPTIONS)).toEqual(labelTheme('Léa', DEFAULT_OPTIONS));
    expect(labelTheme('Youssef', DEFAULT_OPTIONS)).toEqual(labelTheme('Youssef', DEFAULT_OPTIONS));
  });

  it('spreads a class over several colours and drawings', () => {
    const themes = CLASS.map((name) => labelTheme(name, DEFAULT_OPTIONS));
    expect(new Set(themes.map((theme) => theme.ink)).size).toBeGreaterThan(3);
    expect(new Set(themes.map((theme) => theme.mascot)).size).toBeGreaterThan(3);
  });

  it('tells apart two children sharing a first name', () => {
    expect(labelTheme('Léa B', DEFAULT_OPTIONS)).not.toEqual(labelTheme('Léa M', DEFAULT_OPTIONS));
  });

  it('keeps the drawing when the palette changes, and the reverse', () => {
    const rainbow = labelTheme('Léa', withOptions({ palette: 'rainbow' }));
    const ocean = labelTheme('Léa', withOptions({ palette: 'ocean' }));
    const space = labelTheme('Léa', withOptions({ mascots: 'space' }));
    expect(ocean.mascot).toBe(rainbow.mascot);
    expect(ocean.ink).not.toBe(rainbow.ink);
    expect(space.ink).toBe(rainbow.ink);
    expect(space.mascot).not.toBe(rainbow.mascot);
  });

  it('prints the whole class in black on the plain palette', () => {
    const themes = CLASS.map((name) => labelTheme(name, withOptions({ palette: 'plain' })));
    expect(new Set(themes.map((theme) => theme.ink)).size).toBe(1);
    expect(new Set(themes.map((theme) => theme.tint))).toEqual(new Set(['#ffffff']));
    expect(brightness(themes[0]!.ink)).toBeLessThan(0.2);
  });

  it('drops the drawing when it is turned off', () => {
    expect(labelTheme('Léa', withOptions({ mascots: 'none' })).mascot).toBe('');
  });

  it('gives the whole class the chosen colour on the single palette', () => {
    const options = withOptions({ palette: 'single', colour: '#4c1d95' });
    const inks = new Set(CLASS.map((name) => labelTheme(name, options).ink));
    expect(inks).toEqual(new Set(['#4c1d95']));
    // The drawings still tell the children apart.
    expect(new Set(CLASS.map((name) => labelTheme(name, options).mascot)).size).toBeGreaterThan(3);
  });

  it('backs the label with a pale version of its ink', () => {
    const { ink, tint } = labelTheme('Léa', DEFAULT_OPTIONS);
    expect(brightness(tint)).toBeGreaterThan(0.9);
    expect(brightness(tint)).toBeGreaterThan(brightness(ink));
  });

  it('survives an empty name', () => {
    expect(labelTheme('', DEFAULT_OPTIONS)).toEqual(labelTheme('', DEFAULT_OPTIONS));
    expect(labelTheme('', DEFAULT_OPTIONS).ink).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe('palettes', () => {
  // The ceiling is a safety margin, not the decoding limit: photo-reading.test.ts
  // photographs every ink of every palette and checks it comes back.
  it.each(Object.entries(PALETTES))('keeps the %s inks dark enough to be decoded', (_, inks) => {
    for (const ink of inks) expect(brightness(ink)).toBeLessThan(0.4);
  });

  it('offers eight distinct colours per palette', () => {
    for (const inks of Object.values(PALETTES)) expect(new Set(inks).size).toBe(8);
  });
});

describe('readableInk', () => {
  it('leaves an already dark colour alone', () => {
    expect(readableInk('#1d4ed8')).toBe('#1d4ed8');
  });

  it('darkens a colour picked too pale, keeping its hue', () => {
    // Canary yellow: unreadable as a QR code, printed as mustard.
    const ink = readableInk('#ffe000');
    expect(brightness(ink)).toBeLessThanOrEqual(0.33);
    const [red, green, blue] = channelsOf(ink)!;
    expect(red).toBeGreaterThan(blue!);
    expect(green).toBeGreaterThan(blue!);
  });

  it.each(['#ffffff', '#ffff00', '#00ff00', '#ff00ff', '#87cefa', '#000000'])(
    'brings %s under the decoding ceiling',
    (colour) => {
      expect(brightness(readableInk(colour))).toBeLessThanOrEqual(0.33);
    },
  );

  it('falls back to black on a value that is not a colour', () => {
    expect(readableInk('bleu')).toMatch(/^#[0-9a-f]{6}$/);
    expect(brightness(readableInk(''))).toBeLessThan(0.2);
  });
});
