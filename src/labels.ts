// Printable sheet of QR labels: one QR per first name, repeated n times.
import './style.css';
import { qrCodeSvg } from './qr-generation';
import {
  DEFAULT_OPTIONS,
  readableInk,
  type LabelOptions,
  type MascotSet,
  type PaletteName,
  type LabelSize,
} from './label-theme';
import { pages } from './label-layout';
import { applyLayout, labelCard } from './label-card';
import { showRail } from './step-rail';
import { required } from './dom';

// The prefix is the app's old name, and it stays: it identifies data already
// sitting in the teacher's browser, not the app. Renaming it would silently
// empty her class list and reset the sheet style, with nothing on screen to say
// why. Same reason in photos.ts.
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
const printReason = required('print-reason', HTMLParagraphElement);
const railSteps = [...required('rail', HTMLOListElement).querySelectorAll('li')];

/** Names of the last generated sheet, so a style change redraws it at once. */
let printedNames: string[] = [];

namesField.value = localStorage.getItem(NAMES_STORAGE_KEY) ?? '';
namesField.addEventListener('input', () => {
  localStorage.setItem(NAMES_STORAGE_KEY, namesField.value);
  showProgress();
});

showOptions(storedOptions());
for (const field of [paletteField, colourField, mascotsField, sizeField]) {
  // `input` rather than `change`: dragging through the colour wheel repaints
  // the sheet live, which is the whole point of choosing a colour.
  field.addEventListener('input', optionsChanged);
}
optionsChanged();
showProgress();

required('generate', HTMLButtonElement).addEventListener('click', () => {
  printedNames = namesField.value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  draw();
  showProgress();
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
  applyLayout(sheet, options.size);
  if (printedNames.length > 0) draw();
}

/**
 * Where the teacher is in the three moments of the page: a list typed, then a
 * sheet drawn.
 */
function showProgress(): void {
  const typedAName = namesField.value.split('\n').some((line) => line.trim() !== '');
  const current = printedNames.length > 0 ? 3 : typedAName ? 2 : 1;
  showRail(
    railSteps,
    railSteps.map((_, index) => index + 1 < current),
    current,
  );
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
    printReason.hidden = false;
    return;
  }

  const cards: HTMLDivElement[] = [];
  for (const firstName of printedNames) {
    // The QR code only depends on the name: generated once, cloned for the
    // other copies.
    const svg = qrCodeSvg(firstName);
    for (let i = 0; i < copies; i++) cards.push(labelCard(firstName, svg, options));
  }

  // Cutting the sheet into pages ourselves is what keeps the labels whole: the
  // browser only has to break where we already broke.
  const sheets = pages(cards, options.size);
  sheets.forEach((page, index) => {
    sheet.append(pageElement(page, index + 1, sheets.length));
  });

  // Nothing to say once the sheet is there: it is on screen, each page carries
  // its own number, and counting the labels back to the teacher tells her what
  // she just typed.
  summary.textContent = '';
  printButton.disabled = false;
  printReason.hidden = true;
}

/**
 * One page of the sheet, announced by its number: the teacher sees before
 * printing what will come out of the printer, page by page.
 */
function pageElement(cards: HTMLDivElement[], number: number, total: number): HTMLElement {
  const page = document.createElement('section');
  page.className = 'sheet-page';

  const caption = document.createElement('p');
  caption.className = 'sheet-page-number no-print';
  caption.textContent = `Page ${String(number)} sur ${String(total)}`;
  page.append(caption);

  const paper = document.createElement('div');
  paper.className = 'sheet-paper';
  paper.append(...cards);
  page.append(paper);

  return page;
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
