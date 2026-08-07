// Printable sheet of QR labels: one QR per first name, repeated n times.
import './style.css';
import { qrCodeSvg } from './qr-generation';
import { labelTheme } from './label-theme';
import { required } from './dom';

const NAMES_STORAGE_KEY = 'qr-school.names';
const MIN_COPIES = 1;
const MAX_COPIES = 60;

const namesField = required('names', HTMLTextAreaElement);
const copiesField = required('copies', HTMLInputElement);
const colourField = required('colour', HTMLInputElement);
const sheet = required('sheet', HTMLDivElement);
const summary = required('summary', HTMLParagraphElement);
const printButton = required('print', HTMLButtonElement);

namesField.value = localStorage.getItem(NAMES_STORAGE_KEY) ?? '';
namesField.addEventListener('input', () => {
  localStorage.setItem(NAMES_STORAGE_KEY, namesField.value);
});

// Colour is a CSS switch rather than a property of the generated code: the
// teacher can compare both on screen without waiting for a new sheet.
colourField.addEventListener('change', applyColourChoice);
applyColourChoice();

function applyColourChoice(): void {
  sheet.classList.toggle('sheet-plain', !colourField.checked);
}

required('generate', HTMLButtonElement).addEventListener('click', generate);
printButton.addEventListener('click', () => {
  window.print();
});

function generate(): void {
  const firstNames = namesField.value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const copies = Math.max(
    MIN_COPIES,
    Math.min(MAX_COPIES, Number.parseInt(copiesField.value, 10) || MIN_COPIES),
  );

  sheet.textContent = '';

  if (firstNames.length === 0) {
    summary.textContent = 'Tapez au moins un prénom.';
    printButton.disabled = true;
    return;
  }

  for (const firstName of firstNames) {
    const svg = qrCodeSvg(firstName);
    for (let i = 0; i < copies; i++) sheet.append(labelCard(firstName, svg));
  }

  summary.textContent = `${firstNames.length} prénom(s) × ${copies} = ${firstNames.length * copies} étiquettes.`;
  printButton.disabled = false;
}

function labelCard(firstName: string, svg: string): HTMLDivElement {
  const theme = labelTheme(firstName);

  const card = document.createElement('div');
  card.className = 'label-card';
  card.style.setProperty('--theme-ink', theme.ink);
  card.style.setProperty('--theme-tint', theme.tint);

  const frame = document.createElement('div');
  frame.className = 'label-qr';
  // `svg` is built by us from the QR matrix, not from user input: only the
  // first name is typed, and it goes through textContent just below.
  frame.innerHTML = svg;
  card.append(frame);

  const caption = document.createElement('div');
  caption.className = 'label-name';

  const mascot = document.createElement('span');
  // Decoration only: a screen reader announcing « renard » before the name
  // would help nobody.
  mascot.setAttribute('aria-hidden', 'true');
  mascot.className = 'label-mascot';
  mascot.textContent = theme.mascot;

  const name = document.createElement('span');
  name.textContent = firstName;

  caption.append(mascot, name);
  card.append(caption);
  return card;
}
