// What a label looks like: its colour and its drawing. Deliberately DOM-free:
// everything here is unit-tested.
//
// A child who cannot read yet still recognises "the orange label with the fox".
// The colour is derived from the first name, so the same child always gets the
// same one — on today's sheet and on the one printed next term. The teacher
// only chooses the style of the whole sheet, never label by label.

export interface LabelTheme {
  /** Colour of the QR code and of the first name. */
  ink: string;
  /** Pale background of the label. */
  tint: string;
  /** Small drawing next to the first name, empty when they are turned off. */
  mascot: string;
}

export type PaletteName = 'rainbow' | 'ocean' | 'candy' | 'single' | 'plain';
export type MascotSet = 'animals' | 'nature' | 'space' | 'none';
export type LabelSize = 'small' | 'medium' | 'large';

/** Everything the teacher sets once for the whole sheet. */
export interface LabelOptions {
  palette: PaletteName;
  /** Ink of the `single` palette, as picked in the colour field. */
  colour: string;
  mascots: MascotSet;
  size: LabelSize;
}

export const DEFAULT_OPTIONS: LabelOptions = {
  palette: 'rainbow',
  colour: '#1d4ed8',
  mascots: 'animals',
  size: 'medium',
};

/**
 * Every ink stays dark, whichever palette is chosen: zxing separates the QR
 * modules from the paper on brightness alone, so a pastel code would simply
 * stop being read. All of these sit below 40 % of the brightness of white,
 * like a mid-grey — the measured decoding limit is far above that, but
 * printers and photocopiers lighten a colour more than a black.
 */
export const PALETTES: Record<'rainbow' | 'ocean' | 'candy', readonly string[]> = {
  // Blueberry, raspberry, mint, grape, clementine, lagoon, bubblegum, apple.
  rainbow: ['#1d4ed8', '#be123c', '#047857', '#6d28d9', '#c2410c', '#0e7490', '#a21caf', '#4d7c0f'],
  ocean: ['#1e40af', '#0f766e', '#0369a1', '#115e59', '#1d4ed8', '#047857', '#0e7490', '#155e75'],
  candy: ['#be123c', '#a21caf', '#c2410c', '#9d174d', '#7e22ce', '#b91c1c', '#be185d', '#854d0e'],
};

const MASCOT_SETS: Record<'animals' | 'nature' | 'space', readonly string[]> = {
  animals: ['🦊', '🐢', '🐙', '🦋', '🐝', '🦄', '🐳', '🐧', '🦉', '🐬', '🐘', '🐸'],
  nature: ['🌻', '🌈', '🍄', '🌸', '🌵', '🍀', '🌙', '⭐', '🍎', '🌊', '🔥', '🍁'],
  space: ['🚀', '🛸', '🪐', '🌟', '☄️', '🌍', '👽', '🔭', '🌜', '⚡', '🛰️', '🌌'],
};

/** Ink of the `plain` palette, and fallback whenever a colour makes no sense. */
export const PLAIN_INK = '#111827';

/**
 * Brightness a chosen colour is brought down to. Below the 40 % ceiling of the
 * palettes, with room to spare: the teacher picks from a colour wheel, not from
 * a list vetted against the decoder.
 */
const CHOSEN_INK_BRIGHTNESS = 0.32;

export function labelTheme(firstName: string, options: LabelOptions): LabelTheme {
  return { ...inkAndTint(firstName, options), mascot: mascotOf(firstName, options.mascots) };
}

function inkAndTint(firstName: string, options: LabelOptions): Omit<LabelTheme, 'mascot'> {
  if (options.palette === 'plain') return { ink: PLAIN_INK, tint: '#ffffff' };

  const ink =
    options.palette === 'single'
      ? readableInk(options.colour)
      : pick(PALETTES[options.palette], firstName, 31);
  return { ink, tint: paleVersionOf(ink) };
}

function mascotOf(firstName: string, set: MascotSet): string {
  // A different multiplier from the colour, so that the two are picked
  // independently: 8 colours × 12 drawings give 96 combinations, enough for two
  // children of a class never to share both.
  return set === 'none' ? '' : pick(MASCOT_SETS[set], firstName, 131);
}

/**
 * The colour as it will be printed: hue kept, brightness brought down until the
 * QR code can be read. A teacher picking canary yellow gets mustard rather than
 * a sheet of labels no phone can scan.
 */
export function readableInk(colour: string): string {
  const channels = channelsOf(colour);
  if (!channels) return PLAIN_INK;

  const brightness = brightnessOf(channels);
  // Brightness is a weighted sum of the channels, so scaling all three by the
  // same factor scales it by exactly that factor.
  if (brightness <= CHOSEN_INK_BRIGHTNESS) return toHex(channels);
  const factor = CHOSEN_INK_BRIGHTNESS / brightness;
  return toHex(channels.map((channel) => Math.round(channel * factor)));
}

/** Background of the label: a tenth of the ink over white. */
function paleVersionOf(ink: string): string {
  const channels = channelsOf(ink);
  if (!channels) return '#ffffff';
  return toHex(channels.map((channel) => Math.round(channel * 0.1 + 255 * 0.9)));
}

/** Brightness as the decoder perceives it, from 0 (black) to 1 (white). */
export function brightnessOf(channels: number[]): number {
  const [red, green, blue] = channels;
  return (0.299 * (red ?? 0) + 0.587 * (green ?? 0) + 0.114 * (blue ?? 0)) / 255;
}

export function channelsOf(colour: string): number[] | undefined {
  if (!/^#[0-9a-f]{6}$/i.test(colour)) return undefined;
  return [1, 3, 5].map((start) => Number.parseInt(colour.slice(start, start + 2), 16));
}

function toHex(channels: number[]): string {
  return `#${channels.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

/** Same first name, same entry — today and next term. */
function pick(values: readonly string[], firstName: string, multiplier: number): string {
  // A modulo always lands inside the array; TypeScript cannot know that, hence
  // the fallback.
  return values[hash(firstName, multiplier) % values.length] ?? PLAIN_INK;
}

function hash(text: string, multiplier: number): number {
  let value = 0;
  // Iterating with `for…of` walks code points, so an accent or an emoji in the
  // name counts as one character rather than two halves of a surrogate pair.
  for (const character of text)
    value = (value * multiplier + (character.codePointAt(0) ?? 0)) >>> 0;
  return value;
}
