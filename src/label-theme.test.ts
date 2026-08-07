import { describe, expect, it } from 'vitest';
import { INKS, labelTheme } from './label-theme';

describe('labelTheme', () => {
  it('gives the same child the same colour every time', () => {
    expect(labelTheme('Léa')).toEqual(labelTheme('Léa'));
    expect(labelTheme('Youssef')).toEqual(labelTheme('Youssef'));
  });

  it('spreads a class over several colours and mascots', () => {
    const names = ['Léa', 'Noé', 'Camille', 'Youssef', 'Marie-Claire', 'Tom', 'Zoé', 'Ibrahim'];
    const themes = names.map(labelTheme);
    expect(new Set(themes.map((theme) => theme.ink)).size).toBeGreaterThan(3);
    expect(new Set(themes.map((theme) => theme.mascot)).size).toBeGreaterThan(3);
  });

  it('tells apart two children sharing a first name', () => {
    expect(labelTheme('Léa B')).not.toEqual(labelTheme('Léa M'));
  });

  it('keeps the ink dark enough for the QR code to be decoded', () => {
    // Perceived brightness, the quantity zxing thresholds on. The ceiling is a
    // safety margin, not the decoding limit: photo-reading.test.ts photographs
    // every ink of the palette and checks it comes back.
    for (const { ink } of INKS) {
      const [red, green, blue] = [1, 3, 5].map((start) =>
        Number.parseInt(ink.slice(start, start + 2), 16),
      );
      const brightness = (0.299 * red! + 0.587 * green! + 0.114 * blue!) / 255;
      expect(brightness).toBeLessThan(0.4);
    }
  });

  it('survives an empty name', () => {
    expect(labelTheme('')).toEqual(labelTheme(''));
    expect(labelTheme('').ink).toMatch(/^#[0-9a-f]{6}$/);
  });
});
