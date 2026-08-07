// Colour and mascot of a label. Deliberately DOM-free: everything here is
// unit-tested.
//
// A child who cannot read yet still recognises "the orange label with the fox".
// The colour is derived from the first name, so the same child always gets the
// same one — on today's sheet and on the one printed next term.

export interface LabelTheme {
  /** Colour of the QR code and of the first name. */
  ink: string;
  /** Pastel background of the label. */
  tint: string;
  /** Small drawing next to the first name. */
  mascot: string;
}

/**
 * All inks stay dark: zxing separates the QR modules from the paper on
 * brightness alone, so a pastel code would simply stop being read. Each of
 * these sits below 40 % of the brightness of white, like a mid-grey — the
 * measured decoding limit is far above that, but printers and photocopiers
 * lighten a colour more than a black.
 */
export const INKS: readonly Omit<LabelTheme, 'mascot'>[] = [
  { ink: '#1d4ed8', tint: '#eff6ff' }, // blueberry
  { ink: '#be123c', tint: '#fff1f2' }, // raspberry
  { ink: '#047857', tint: '#ecfdf5' }, // mint
  { ink: '#6d28d9', tint: '#f5f3ff' }, // grape
  { ink: '#c2410c', tint: '#fff7ed' }, // clementine
  { ink: '#0e7490', tint: '#ecfeff' }, // lagoon
  { ink: '#a21caf', tint: '#fdf4ff' }, // bubblegum
  { ink: '#4d7c0f', tint: '#f7fee7' }, // apple
];

const MASCOTS = ['🦊', '🐢', '🐙', '🦋', '🐝', '🦄', '🐳', '🌻', '🐧', '🦉', '🐬', '🌈'] as const;

/** Ink used when the teacher prints without colour. */
export const PLAIN_INK = '#111827';

export function labelTheme(firstName: string): LabelTheme {
  // Two different multipliers so that the colour and the mascot are picked
  // independently: 8 colours × 12 mascots give 96 combinations, enough for two
  // children of a class never to share both.
  const colour = INKS[hash(firstName, 31) % INKS.length];
  const mascot = MASCOTS[hash(firstName, 131) % MASCOTS.length];
  // `firstName` is arbitrary, but a modulo always lands inside the array;
  // TypeScript cannot know that, hence the fallbacks.
  return { ...(colour ?? { ink: PLAIN_INK, tint: '#ffffff' }), mascot: mascot ?? '⭐' };
}

function hash(text: string, multiplier: number): number {
  let value = 0;
  // Iterating with `for…of` walks code points, so an accent or an emoji in the
  // name counts as one character rather than two halves of a surrogate pair.
  for (const character of text)
    value = (value * multiplier + (character.codePointAt(0) ?? 0)) >>> 0;
  return value;
}
