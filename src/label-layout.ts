// Where the labels land on the paper. Deliberately DOM-free: these numbers are
// unit-tested, and the stylesheet reads them back as custom properties, so the
// sheet on screen and the sheet on paper are laid out by the same arithmetic.
//
// The reason for fixing the geometry in millimetres is printing integrity. A
// grid of labels left to flow is cut wherever the page happens to end, and
// `break-inside: avoid` only asks the browser not to — Chromium obliges, others
// fragment a grid as they see fit. Here a page holds a whole number of rows
// that provably fit inside A4, and `labels.ts` puts each page in its own
// element with a page break in between: nothing ever has to be split, so no
// label can come out of the printer in halves.

import type { LabelSize } from './label-theme';

/** A4 portrait, and the margin of the `@page` rule in `style.css`. */
export const PAGE = { width: 210, height: 297, margin: 8 } as const;

/** Space between two labels: the pair of scissors' margin. */
export const GAP = 4;

/**
 * The parts of a label that do not change with its size: the dashed border,
 * the padding inside it, the padding of the white frame around the code, and
 * the space between that frame and the first name.
 */
export const BOX = { border: 0.5, padding: 2, framePadding: 1.5, captionGap: 1.5 } as const;

/** What the border, the padding and the frame add around the code. */
const AROUND_QR = BOX.border + BOX.padding + BOX.framePadding;

/**
 * The caption is sized for two lines: `Jean-Baptiste B` wraps on a small label,
 * and a height that depends on the name would make the page count a guess.
 */
const CAPTION_LINES = 2;

/** Line height of the first name, mirrored in `.label-name`. */
const LINE_HEIGHT = 1.2;

/**
 * The drawing next to the first name, as a share of it. Kept under
 * `LINE_HEIGHT` so that the name, not the drawing, sets the caption's height.
 */
export const MASCOT_RATIO = 1.15;

interface SizeChoice {
  columns: number;
  /** Side of the QR code, the one measurement the teacher actually chooses. */
  qr: number;
  /** Font size of the first name. */
  name: number;
}

const SIZES: Record<LabelSize, SizeChoice> = {
  small: { columns: 4, qr: 30, name: 3.9 },
  medium: { columns: 3, qr: 44, name: 5.3 },
  large: { columns: 2, qr: 62, name: 7.4 },
};

/** Every measurement of one sheet, in millimetres. */
export interface SheetLayout {
  columns: number;
  rows: number;
  /** Labels on a full page — what `labels.ts` cuts the list into. */
  perPage: number;
  labelWidth: number;
  labelHeight: number;
  qrSize: number;
  nameSize: number;
  captionHeight: number;
}

/** Printable area of a page, once the `@page` margins are taken off. */
export function printableArea(): { width: number; height: number } {
  return { width: PAGE.width - 2 * PAGE.margin, height: PAGE.height - 2 * PAGE.margin };
}

export function sheetLayout(size: LabelSize): SheetLayout {
  const choice = SIZES[size];
  const area = printableArea();

  const labelWidth = (area.width - GAP * (choice.columns - 1)) / choice.columns;
  // The frame around the code cannot be wider than the label, however large a
  // code was asked for. Taking the smaller of the two keeps the height below
  // honest, since the code is square.
  const qrSize = Math.min(choice.qr, labelWidth - 2 * AROUND_QR);
  const captionHeight = CAPTION_LINES * LINE_HEIGHT * choice.name;
  const labelHeight = 2 * AROUND_QR + qrSize + BOX.captionGap + captionHeight;

  // A row costs its own height plus the gap above it, except the first one —
  // hence the gap added on both sides of the division.
  const rows = Math.floor((area.height + GAP) / (labelHeight + GAP));

  return {
    columns: choice.columns,
    rows,
    perPage: choice.columns * rows,
    labelWidth,
    labelHeight,
    qrSize,
    nameSize: choice.name,
    captionHeight,
  };
}

/** Pages a run of labels will come out on — what the summary announces. */
export function pageCount(labels: number, size: LabelSize): number {
  return Math.ceil(labels / sheetLayout(size).perPage);
}

/** The labels of each page, in order. */
export function pages<T>(labels: readonly T[], size: LabelSize): T[][] {
  const { perPage } = sheetLayout(size);
  const sheets: T[][] = [];
  for (let start = 0; start < labels.length; start += perPage) {
    sheets.push(labels.slice(start, start + perPage));
  }
  return sheets;
}
