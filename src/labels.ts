// Printable sheet of QR labels: one QR per first name, repeated n times.
//
// Alpine drives the page: `labelsPage` below holds the whole state, and
// `labels.html` binds to it. The sheet is a getter over that state, so a style
// change repaints it with nothing to call by hand. The QR codes and the theme
// of each label are built here rather than in the markup, so what ends up in
// the page stays something this file produced.

import './style.css';
import Alpine from 'alpinejs';
import { qrCodeSvg } from './qr-generation';
import { loadClassList, saveClassList, splitNames } from './class-list';
import {
  DEFAULT_OPTIONS,
  labelTheme,
  readableInk,
  type LabelOptions,
  type LabelSize,
  type MascotSet,
  type PaletteName,
} from './label-theme';

const OPTIONS_STORAGE_KEY = 'qr-school.label-options';
const MIN_COPIES = 1;
const MAX_COPIES = 60;

const PALETTE_NAMES: readonly PaletteName[] = ['rainbow', 'ocean', 'candy', 'single', 'plain'];
const MASCOT_SETS: readonly MascotSet[] = ['animals', 'nature', 'space', 'none'];
const LABEL_SIZES: readonly LabelSize[] = ['small', 'medium', 'large'];
const COLOUR = /^#[0-9a-f]{6}$/i;

/** One label on the sheet, ready to display. */
interface Label {
  /** Position on the sheet: first names repeat, so they cannot be the key. */
  id: number;
  firstName: string;
  svg: string;
  /** `--ink` and `--tint`, which `.label-card` reads. */
  style: string;
  /** Empty when the drawings are turned off. */
  mascot: string;
}

function oneOf<T extends string>(allowed: readonly T[], value: unknown, fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

/**
 * Choices of the previous session. Anything unreadable — an older version of
 * the page, a hand-edited entry — falls back to the defaults rather than
 * breaking the sheet: a `<select>` handed a value it does not offer would end
 * up showing nothing at all.
 */
function storedOptions(): LabelOptions {
  let stored: Partial<LabelOptions> = {};
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(OPTIONS_STORAGE_KEY) ?? '{}');
    if (typeof raw === 'object' && raw !== null) stored = raw;
  } catch {
    return DEFAULT_OPTIONS;
  }
  return {
    palette: oneOf(PALETTE_NAMES, stored.palette, DEFAULT_OPTIONS.palette),
    colour:
      typeof stored.colour === 'string' && COLOUR.test(stored.colour)
        ? stored.colour
        : DEFAULT_OPTIONS.colour,
    mascots: oneOf(MASCOT_SETS, stored.mascots, DEFAULT_OPTIONS.mascots),
    size: oneOf(LABEL_SIZES, stored.size, DEFAULT_OPTIONS.size),
  };
}

function labelsPage() {
  const initial = storedOptions();

  return {
    names: loadClassList(),
    /** Kept as typed: `<input type="number">` hands back a string. */
    copies: '8',

    // --- The style of the whole sheet --------------------------------------
    palette: initial.palette,
    colour: initial.colour,
    mascots: initial.mascots,
    size: initial.size,

    /**
     * The sheet the teacher asked for. Names and count are taken when she
     * clicks « Générer » — typing a name does not redraw — while the style is
     * live, which is the whole point of the panel.
     */
    printedNames: [] as string[],
    printedCopies: MIN_COPIES,
    asked: false,

    init(): void {
      // `Alpine.effect` rather than the `$watch` magic: the magics only exist
      // inside Alpine expressions, where `tsc` cannot follow, while the methods
      // on the imported `Alpine` are typed.
      //
      // The class list is shared with the "Ranger les photos" page.
      Alpine.effect(() => {
        saveClassList(this.names);
      });
      Alpine.effect(() => {
        localStorage.setItem(OPTIONS_STORAGE_KEY, JSON.stringify(this.options));
      });
    },

    get options(): LabelOptions {
      return {
        palette: this.palette,
        colour: this.colour,
        mascots: this.mascots,
        size: this.size,
      };
    },

    /**
     * Only the size class: `x-bind:class` adds to the static `class`, it does
     * not replace it, so leaving `sheet-medium` in the markup would keep it
     * alongside the chosen one and let the later of the two rules win.
     */
    get sheetClass(): string {
      return `sheet-${this.size}`;
    },

    /** The colour wheel only means something for the single-colour palette. */
    get choosesColour(): boolean {
      return this.palette === 'single';
    },

    /**
     * The colour the labels will really carry: a pale pick comes out darker,
     * and seeing it beats discovering it on paper.
     */
    get appliedColourStyle(): string {
      return `background: ${readableInk(this.colour)}`;
    },

    get labels(): Label[] {
      const options = this.options;
      const sheet: Label[] = [];
      let id = 0;

      for (const firstName of this.printedNames) {
        // The QR code only depends on the name: generated once, reused for the
        // other copies.
        const svg = qrCodeSvg(firstName);
        const theme = labelTheme(firstName, options);
        const style = `--ink: ${theme.ink}; --tint: ${theme.tint}`;
        for (let copy = 0; copy < this.printedCopies; copy++) {
          sheet.push({ id: id++, firstName, svg, style, mascot: theme.mascot });
        }
      }
      return sheet;
    },

    get canPrint(): boolean {
      return this.labels.length > 0;
    },

    get summary(): string {
      if (!this.asked) return '';
      if (this.printedNames.length === 0) return 'Tapez au moins un prénom.';
      return `${this.printedNames.length} prénom(s) × ${this.printedCopies} = ${this.labels.length} étiquettes.`;
    },

    generate(): void {
      this.printedNames = splitNames(this.names);
      this.printedCopies = Math.max(
        MIN_COPIES,
        Math.min(MAX_COPIES, Number.parseInt(this.copies, 10) || MIN_COPIES),
      );
      this.asked = true;
    },

    print(): void {
      window.print();
    },
  };
}

Alpine.data('labelsPage', labelsPage);
Alpine.start();
