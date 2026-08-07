// Planche d'étiquettes QR à imprimer : un QR par prénom, répété n fois.
import './style.css';
import { svgQrCode } from './generation-qr';

const CLE_STOCKAGE = 'qr-school.prenoms';
const COPIES_MIN = 1;
const COPIES_MAX = 60;

const champPrenoms = requis<HTMLTextAreaElement>('prenoms');
const champCopies = requis<HTMLInputElement>('copies');
const planche = requis<HTMLDivElement>('planche');
const resume = requis<HTMLParagraphElement>('resume');
const boutonImprimer = requis<HTMLButtonElement>('imprimer');

champPrenoms.value = localStorage.getItem(CLE_STOCKAGE) ?? '';
champPrenoms.addEventListener('input', () => {
  localStorage.setItem(CLE_STOCKAGE, champPrenoms.value);
});

requis<HTMLButtonElement>('generer').addEventListener('click', generer);
boutonImprimer.addEventListener('click', () => window.print());

function generer(): void {
  const prenoms = champPrenoms.value
    .split('\n')
    .map((ligne) => ligne.trim())
    .filter(Boolean);

  const copies = Math.max(
    COPIES_MIN,
    Math.min(COPIES_MAX, Number.parseInt(champCopies.value, 10) || COPIES_MIN),
  );

  planche.textContent = '';

  if (prenoms.length === 0) {
    resume.textContent = 'Tapez au moins un prénom.';
    boutonImprimer.disabled = true;
    return;
  }

  for (const prenom of prenoms) {
    const svg = svgQrCode(prenom);
    for (let i = 0; i < copies; i++) planche.append(etiquette(prenom, svg));
  }

  resume.textContent =
    `${prenoms.length} prénom(s) × ${copies} = ${prenoms.length * copies} étiquettes.`;
  boutonImprimer.disabled = false;
}

function etiquette(prenom: string, svg: string): HTMLDivElement {
  const div = document.createElement('div');
  div.className = 'etiquette';
  // `svg` vient de qrcode-generator, pas d'une saisie : seul le prénom est
  // utilisateur, et il passe par textContent juste en dessous.
  div.innerHTML = svg;

  const nom = document.createElement('div');
  nom.className = 'mt-1 text-[14pt] font-bold break-words';
  nom.textContent = prenom;
  div.append(nom);
  return div;
}

function requis<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Élément « ${id} » introuvable`);
  return element as T;
}
