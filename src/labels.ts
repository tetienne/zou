// Printable sheet of QR labels: one QR per first name, repeated n times.
import './style.css';
import { qrCodeSvg } from './qr-generation';
import { required } from './dom';

const NAMES_STORAGE_KEY = 'qr-school.names';
const MIN_COPIES = 1;
const MAX_COPIES = 60;

const namesField = required('names', HTMLTextAreaElement);
const copiesField = required('copies', HTMLInputElement);
const sheet = required('sheet', HTMLDivElement);
const summary = required('summary', HTMLParagraphElement);
const printButton = required('print', HTMLButtonElement);

namesField.value = localStorage.getItem(NAMES_STORAGE_KEY) ?? '';
namesField.addEventListener('input', () => {
  localStorage.setItem(NAMES_STORAGE_KEY, namesField.value);
});

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
  const card = document.createElement('div');
  card.className = 'label-card';
  // `svg` comes from qrcode-generator, not from user input: only the first name
  // is typed, and it goes through textContent just below.
  card.innerHTML = svg;

  const caption = document.createElement('div');
  caption.className = 'mt-1 text-[14pt] font-bold break-words';
  caption.textContent = firstName;
  card.append(caption);
  return card;
}
