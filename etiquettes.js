// Génération d'une planche d'étiquettes QR à imprimer.
// Le QR code contient simplement le prénom, tel qu'il est tapé.

const champPrenoms = document.getElementById('prenoms');
const champCopies = document.getElementById('copies');
const planche = document.getElementById('planche');
const resume = document.getElementById('resume');
const boutonImprimer = document.getElementById('imprimer');

const CLE_STOCKAGE = 'qr-school.prenoms';

champPrenoms.value = localStorage.getItem(CLE_STOCKAGE) || '';
champPrenoms.addEventListener('input', () => {
  localStorage.setItem(CLE_STOCKAGE, champPrenoms.value);
});

document.getElementById('generer').addEventListener('click', generer);
boutonImprimer.addEventListener('click', () => window.print());

function generer() {
  const prenoms = champPrenoms.value
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const copies = Math.max(1, Math.min(60, parseInt(champCopies.value, 10) || 1));

  planche.textContent = '';

  if (prenoms.length === 0) {
    resume.textContent = 'Tapez au moins un prénom.';
    boutonImprimer.disabled = true;
    return;
  }

  for (const prenom of prenoms) {
    const svg = svgQr(prenom);
    for (let i = 0; i < copies; i++) {
      planche.appendChild(etiquette(prenom, svg));
    }
  }

  resume.textContent =
    `${prenoms.length} prénom(s) × ${copies} = ${prenoms.length * copies} étiquettes.`;
  boutonImprimer.disabled = false;
}

function svgQr(texte) {
  // Type 0 = taille automatique, correction d'erreur « M » : le QR reste lisible
  // même si l'étiquette est un peu abîmée ou mal éclairée.
  const qr = qrcode(0, 'M');
  qr.addData(texte);
  qr.make();
  return qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true, alt: texte });
}

function etiquette(prenom, svg) {
  const div = document.createElement('div');
  div.className = 'etiquette';
  div.innerHTML = svg;
  const nom = document.createElement('div');
  nom.className = 'prenom';
  nom.textContent = prenom;
  div.appendChild(nom);
  return div;
}
