import { describe, expect, it } from 'vitest';
import { GAP, pageCount, pages, printableArea, sheetLayout } from './label-layout';
import type { LabelSize } from './label-theme';

const SIZES: LabelSize[] = ['small', 'medium', 'large'];

/** Height a page of `rows` rows occupies, gaps included. */
function heightOf(rows: number, labelHeight: number): number {
  return rows * labelHeight + (rows - 1) * GAP;
}

describe('sheetLayout', () => {
  // The one property the printed sheet depends on: what labels.ts puts on a
  // page fits on the page. Nothing is left for the browser to cut in half.
  it.each(SIZES)('fits a full page of %s labels inside the printable area', (size) => {
    const { columns, rows, labelWidth, labelHeight } = sheetLayout(size);
    const area = printableArea();

    expect(heightOf(rows, labelHeight)).toBeLessThanOrEqual(area.height);
    expect(heightOf(columns, labelWidth)).toBeLessThanOrEqual(area.width);
  });

  it.each(SIZES)('leaves no room for another row of %s labels', (size) => {
    const { rows, labelHeight } = sheetLayout(size);
    expect(heightOf(rows + 1, labelHeight)).toBeGreaterThan(printableArea().height);
  });

  it.each(SIZES)('keeps the QR code of a %s label inside the label', (size) => {
    const { qrSize, labelWidth, labelHeight } = sheetLayout(size);
    expect(qrSize).toBeLessThan(labelWidth);
    expect(qrSize).toBeLessThan(labelHeight);
  });

  it.each(SIZES)('leaves room under the QR code of a %s label for two lines', (size) => {
    const { labelHeight, qrSize, captionHeight, nameSize } = sheetLayout(size);
    expect(captionHeight).toBeGreaterThanOrEqual(2 * nameSize);
    expect(labelHeight).toBeGreaterThan(qrSize + captionHeight);
  });

  // What the teacher chooses is a size, and the sizes have to differ in the way
  // the interface promises: 4, 3 then 2 per row, fewer and larger every time.
  it('gives fewer, larger labels as the size grows', () => {
    const [small, medium, large] = SIZES.map(sheetLayout);
    expect([small!.columns, medium!.columns, large!.columns]).toEqual([4, 3, 2]);
    expect(small!.perPage).toBeGreaterThan(medium!.perPage);
    expect(medium!.perPage).toBeGreaterThan(large!.perPage);
    expect(small!.qrSize).toBeLessThan(medium!.qrSize);
    expect(medium!.qrSize).toBeLessThan(large!.qrSize);
  });

  // A code the printer renders too small stops being decoded from a photo taken
  // a metre away. 30 mm is the smallest the interface offers.
  it.each(SIZES)('keeps the QR code of a %s label at least 30 mm wide', (size) => {
    expect(sheetLayout(size).qrSize).toBeGreaterThanOrEqual(30);
  });
});

describe('pageCount', () => {
  it('announces one page as long as the labels fit on one', () => {
    const { perPage } = sheetLayout('medium');
    expect(pageCount(1, 'medium')).toBe(1);
    expect(pageCount(perPage, 'medium')).toBe(1);
    expect(pageCount(perPage + 1, 'medium')).toBe(2);
  });

  it('announces nothing for an empty sheet', () => {
    expect(pageCount(0, 'medium')).toBe(0);
  });
});

describe('pages', () => {
  it('fills every page but the last one', () => {
    const { perPage } = sheetLayout('small');
    const labels = Array.from({ length: 2 * perPage + 3 }, (_, index) => index);
    const sheets = pages(labels, 'small');

    expect(sheets).toHaveLength(3);
    expect(sheets[0]).toHaveLength(perPage);
    expect(sheets[1]).toHaveLength(perPage);
    expect(sheets[2]).toHaveLength(3);
    // Order is what makes a sheet usable: the labels of one child stay together.
    expect(sheets.flat()).toEqual(labels);
  });

  it('makes no page at all out of no label', () => {
    expect(pages([], 'medium')).toEqual([]);
  });
});
