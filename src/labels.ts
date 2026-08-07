// Printable sheet of QR labels: one QR per first name, repeated n times.
import './style.css';
import { qrCodeSvg } from './qr-generation';
import {
  DEFAULT_OPTIONS,
  labelTheme,
  readableInk,
  type LabelOptions,
  type LabelSize,
  type MascotSet,
  type PaletteName,
} from './label-theme';
import { required } from './dom';

const NAMES_STORAGE_KEY = 'qr-school.names';
const OPTIONS_STORAGE_KEY = 'qr-school.label-options';
const MIN_COPIES = 1;
const MAX_COPIES = 60;

const namesField = required('names', HTMLTextAreaElement);
const copiesField = required('copies', HTMLInputElement);
const paletteField = required('palette', HTMLSelectElement);
const colourField = required('colour', HTMLInputElement);
const colourRow = required('colour-row', HTMLParagraphElement);
const appliedColour = required('colour-applied', HTMLSpanElement);
const mascotsField = required('mascots', HTMLSelectElement);
const sizeField = required('size', HTMLSelectElement);
const sheet = required('sheet', HTMLDivElement);
const summary = required('summary', HTMLParagraphElement);
const printButton = required('print', HTMLButtonElement);

/** Names of the last generated sheet, so a style change redraws it at once. */
let printedNames: string[] = [];

namesField.value = localStorage.getItem(NAMES_STORAGE_KEY) ?? '';
namesField.addEventListener('input', () => {
  localStorage.setItem(NAMES_STORAGE_KEY, namesField.value);
});

showOptions(storedOptions());
for (const field of [paletteField, colourField, mascotsField, sizeField]) {
  // `input` rather than `change`: dragging through the colour wheel repaints
  // the sheet live, which is the whole point of choosing a colour.
  field.addEventListener('input', optionsChanged);
}
optionsChanged();

required('generate', HTMLButtonElement).addEventListener('click', () => {
  printedNames = namesField.value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  draw();
});

printButton.addEventListener('click', () => {
  window.print();
});

function optionsChanged(): void {
  const options = currentOptions();
  localStorage.setItem(OPTIONS_STORAGE_KEY, JSON.stringify(options));
  // The colour wheel only means something for the single-colour palette. Next
  // to it, the colour the labels will really carry: a pale pick comes out
  // darker, and seeing it beats discovering it on paper.
  colourRow.hidden = options.palette !== 'single';
  appliedColour.style.background = readableInk(options.colour);
  sheet.className = `label-sheet sheet-${options.size}`;
  if (printedNames.length > 0) draw();
}

function draw(): void {
  const copies = Math.max(
    MIN_COPIES,
    Math.min(MAX_COPIES, Number.parseInt(copiesField.value, 10) || MIN_COPIES),
  );
  const options = currentOptions();

  sheet.textContent = '';

  if (printedNames.length === 0) {
    summary.textContent = 'Tapez au moins un prénom.';
    printButton.disabled = true;
    return;
  }

  for (const firstName of printedNames) {
    // The QR code only depends on the name: generated once, cloned for the
    // other copies.
    const svg = qrCodeSvg(firstName);
    for (let i = 0; i < copies; i++) sheet.append(labelCard(firstName, svg, options));
  }

  summary.textContent = `${printedNames.length} prénom(s) × ${copies} = ${printedNames.length * copies} étiquettes.`;
  printButton.disabled = false;
}

function currentOptions(): LabelOptions {
  return {
    palette: paletteField.value as PaletteName,
    colour: colourField.value,
    mascots: mascotsField.value as MascotSet,
    size: sizeField.value as LabelSize,
  };
}

function showOptions(options: LabelOptions): void {
  paletteField.value = options.palette;
  mascotsField.value = options.mascots;
  sizeField.value = options.size;
  colourField.value = options.colour;

  // A `<select>` given a value it does not offer ends up with nothing selected
  // and an empty value, which no palette matches. Anything left over from an
  // older version of the page therefore falls back to the first entry.
  for (const field of [paletteField, mascotsField, sizeField]) {
    if (field.selectedIndex === -1) field.selectedIndex = 0;
  }
  if (!/^#[0-9a-f]{6}$/i.test(colourField.value)) colourField.value = DEFAULT_OPTIONS.colour;
}

/**
 * Choices of the previous session. Anything unreadable — an old version, a
 * hand-edited entry — falls back to the defaults rather than breaking the page.
 */
function storedOptions(): LabelOptions {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(OPTIONS_STORAGE_KEY) ?? '{}');
    if (typeof stored !== 'object' || stored === null) return DEFAULT_OPTIONS;
    return { ...DEFAULT_OPTIONS, ...(stored as Partial<LabelOptions>) };
  } catch {
    return DEFAULT_OPTIONS;
  }
}

function labelCard(firstName: string, svg: string, options: LabelOptions): HTMLDivElement {
  const theme = labelTheme(firstName, options);

  const card = document.createElement('div');
  card.className = 'label-card';
  card.style.setProperty('--ink', theme.ink);
  card.style.setProperty('--tint', theme.tint);

  const frame = document.createElement('div');
  frame.className = 'label-qr';
  // `svg` is built by us from the QR matrix, not from user input: only the
  // first name is typed, and it goes through textContent just below.
  frame.innerHTML = svg;
  card.append(frame);

  const caption = document.createElement('div');
  caption.className = 'label-name';

  if (theme.mascot) {
    const mascot = document.createElement('span');
    // Decoration only: a screen reader announcing « renard » before the name
    // would help nobody.
    mascot.setAttribute('aria-hidden', 'true');
    mascot.className = 'label-mascot';
    mascot.textContent = theme.mascot;
    caption.append(mascot);
  }

  const name = document.createElement('span');
  name.textContent = firstName;
  caption.append(name);

  card.append(caption);
  return card;
}
