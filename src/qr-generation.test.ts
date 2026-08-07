// The SVG is built square by square rather than by the qrcode-generator helper,
// so that the modules can take the colour of the label. A mistake there would
// print a sheet of unreadable codes without anything looking wrong on screen.
import { describe, expect, it } from 'vitest';
import { qrCodeMatrix, qrCodeSvg } from './qr-generation';

const FIRST_NAME = 'Léa';

/** Squares actually drawn by the SVG, as `row,column` keys. */
function drawnModules(svg: string, quietZone: number): Set<string> {
  return new Set(
    [...svg.matchAll(/M(\d+),(\d+)h1v1h-1z/g)].map(
      ([, column, row]) => `${Number(row) - quietZone},${Number(column) - quietZone}`,
    ),
  );
}

describe('qrCodeSvg', () => {
  it('draws exactly the dark modules of the code', () => {
    const matrix = qrCodeMatrix(FIRST_NAME);
    const svg = qrCodeSvg(FIRST_NAME);
    const [, boxSize] = /viewBox="0 0 (\d+) \1"/.exec(svg) ?? [];
    const quietZone = (Number(boxSize) - matrix.length) / 2;

    const expected = new Set(
      matrix.flatMap((line, row) =>
        line.flatMap((dark, column) => (dark ? [`${row},${column}`] : [])),
      ),
    );
    expect(quietZone).toBeGreaterThanOrEqual(2);
    expect(drawnModules(svg, quietZone)).toEqual(expected);
  });

  it('takes its colour from the label', () => {
    expect(qrCodeSvg(FIRST_NAME)).toContain('fill="currentColor"');
  });
});
