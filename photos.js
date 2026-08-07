// Lecture des QR codes présents sur les photos, puis copie renommée.
// Tout se passe dans le navigateur : aucune photo n'est envoyée sur Internet.

const EXTENSIONS_LUES = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'avif'];
const EXTENSIONS_CONNUES = EXTENSIONS_LUES.concat(['heic', 'heif']);

const supporteDossiers = 'showDirectoryPicker' in window;

const etat = {
  fichiers: [],            // { file, nomOrigine }
  lignes: [],              // voir creerLigne()
  dossierDestination: null,
  analyseFaite: false,
};

const el = {
  avertissement: document.getElementById('avertissement'),
  choisirSource: document.getElementById('choisir-source'),
  nomSource: document.getElementById('nom-source'),
  choisirDestination: document.getElementById('choisir-destination'),
  nomDestination: document.getElementById('nom-destination'),
  sourceSecours: document.getElementById('source-secours'),
  sousDossiers: document.getElementById('sous-dossiers'),
  modele: document.getElementById('modele'),
  analyser: document.getElementById('analyser'),
  remplir: document.getElementById('remplir'),
  progression: document.getElementById('progression'),
  etatAnalyse: document.getElementById('etat-analyse'),
  blocResultats: document.getElementById('bloc-resultats'),
  resultats: document.getElementById('resultats'),
  copier: document.getElementById('copier'),
  etatCopie: document.getElementById('etat-copie'),
  progressionCopie: document.getElementById('progression-copie'),
};

// ---------------------------------------------------------------- démarrage

if (!supporteDossiers) {
  message(
    'Ce navigateur ne sait pas écrire directement dans un dossier. Les photos renommées ' +
    'arriveront une par une dans votre dossier « Téléchargements ». Pour un rangement ' +
    'automatique, utilisez Microsoft Edge ou Google Chrome.'
  );
  el.choisirDestination.disabled = true;
  el.nomDestination.textContent = 'dossier « Téléchargements »';
  el.nomDestination.classList.add('ok');
  el.sousDossiers.checked = false;
  el.sousDossiers.disabled = true;
  el.copier.textContent = 'Télécharger les photos renommées';
}

el.choisirSource.addEventListener('click', choisirSource);
el.choisirDestination.addEventListener('click', choisirDestination);
el.sourceSecours.addEventListener('change', () => {
  const fichiers = [...el.sourceSecours.files].filter((f) => estImage(f.name));
  chargerFichiers(fichiers.map((f) => ({ file: f, nomOrigine: f.name })), 'dossier choisi');
});
el.analyser.addEventListener('click', analyser);
el.remplir.addEventListener('click', remplirLesVides);
el.copier.addEventListener('click', copier);
el.modele.addEventListener('change', recalculerNoms);
el.sousDossiers.addEventListener('change', recalculerNoms);

// ------------------------------------------------------------ choix dossier

async function choisirSource() {
  if (!supporteDossiers) {
    el.sourceSecours.click();
    return;
  }
  let dossier;
  try {
    dossier = await window.showDirectoryPicker({ id: 'photos-source', mode: 'read' });
  } catch (e) {
    return; // annulé par l'utilisatrice
  }

  const entrees = [];
  for await (const entree of dossier.values()) {
    if (entree.kind === 'file' && estImage(entree.name)) entrees.push(entree);
  }
  entrees.sort((a, b) => a.name.localeCompare(b.name, 'fr', { numeric: true }));

  const fichiers = [];
  for (const entree of entrees) {
    fichiers.push({ file: await entree.getFile(), nomOrigine: entree.name });
  }
  chargerFichiers(fichiers, dossier.name);
}

async function choisirDestination() {
  try {
    etat.dossierDestination = await window.showDirectoryPicker({
      id: 'photos-destination',
      mode: 'readwrite',
    });
  } catch (e) {
    return;
  }
  el.nomDestination.textContent = etat.dossierDestination.name;
  el.nomDestination.classList.add('ok');
  majBoutonCopier();
}

function chargerFichiers(fichiers, nomDossier) {
  etat.fichiers = fichiers;
  etat.lignes = [];
  etat.analyseFaite = false;
  el.resultats.textContent = '';
  el.blocResultats.hidden = true;
  el.nomSource.textContent = `${nomDossier} — ${fichiers.length} photo(s)`;
  el.nomSource.classList.add('ok');
  el.analyser.disabled = fichiers.length === 0;
  el.etatAnalyse.textContent = fichiers.length === 0
    ? 'Aucune image trouvée dans ce dossier.'
    : '';
}

// ---------------------------------------------------------------- analyse

let detecteur;

async function detecteurNatif() {
  if (detecteur !== undefined) return detecteur;
  detecteur = null;
  if ('BarcodeDetector' in window) {
    try {
      const formats = await window.BarcodeDetector.getSupportedFormats();
      if (formats.includes('qr_code')) {
        detecteur = new window.BarcodeDetector({ formats: ['qr_code'] });
      }
    } catch (e) { /* on retombe sur jsQR */ }
  }
  return detecteur;
}

async function analyser() {
  el.analyser.disabled = true;
  el.copier.disabled = true;
  el.resultats.textContent = '';
  etat.lignes = [];
  el.blocResultats.hidden = false;
  el.progression.hidden = false;
  el.progression.max = etat.fichiers.length;
  el.progression.value = 0;

  let trouves = 0;
  for (let i = 0; i < etat.fichiers.length; i++) {
    const { file, nomOrigine } = etat.fichiers[i];
    el.etatAnalyse.textContent = `Lecture de ${nomOrigine} (${i + 1}/${etat.fichiers.length})…`;

    let prenom = '';
    let vignette = '';
    let statut = 'manquant';

    if (!EXTENSIONS_LUES.includes(extension(nomOrigine))) {
      statut = 'erreur';
    } else {
      try {
        const lu = await lirePhoto(file);
        vignette = lu.vignette;
        prenom = lu.texte ? extraitPrenom(lu.texte) : '';
        if (prenom) { statut = 'ok'; trouves++; }
      } catch (e) {
        statut = 'erreur';
      }
    }

    etat.lignes.push(creerLigne({ file, nomOrigine, prenom, vignette, statut }));
    el.progression.value = i + 1;
  }

  el.progression.hidden = true;
  el.analyser.disabled = false;
  el.remplir.disabled = false;
  etat.analyseFaite = true;
  el.etatAnalyse.textContent =
    `${trouves} prénom(s) reconnu(s) sur ${etat.fichiers.length} photo(s).`;
  recalculerNoms();
  majBoutonCopier();
}

// Cherche un QR code dans la photo : d'abord avec le lecteur intégré au
// navigateur s'il existe, sinon avec jsQR à plusieurs tailles, puis sur des
// quarts d'image (utile quand l'étiquette est petite dans une grande photo).
async function lirePhoto(file) {
  const image = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    const vignette = fabriqueVignette(image);

    const natif = await detecteurNatif();
    if (natif) {
      const codes = await natif.detect(image).catch(() => []);
      if (codes.length && codes[0].rawValue) return { texte: codes[0].rawValue, vignette };
    }

    for (const taille of [1200, 2000, 3200]) {
      const texte = chercheAvecJsQr(image, { taille });
      if (texte) return { texte, vignette };
    }

    for (const zone of quarts(image)) {
      const texte = chercheAvecJsQr(image, { zone, taille: 1600 });
      if (texte) return { texte, vignette };
    }

    return { texte: '', vignette };
  } finally {
    if (image.close) image.close();
  }
}

const toile = document.createElement('canvas');
const contexte = toile.getContext('2d', { willReadFrequently: true });

function chercheAvecJsQr(image, { zone, taille }) {
  const src = zone || { x: 0, y: 0, w: image.width, h: image.height };
  const facteur = Math.min(1, taille / Math.max(src.w, src.h));
  const largeur = Math.max(1, Math.round(src.w * facteur));
  const hauteur = Math.max(1, Math.round(src.h * facteur));

  toile.width = largeur;
  toile.height = hauteur;
  contexte.drawImage(image, src.x, src.y, src.w, src.h, 0, 0, largeur, hauteur);
  const pixels = contexte.getImageData(0, 0, largeur, hauteur);

  const resultat = jsQR(pixels.data, largeur, hauteur, { inversionAttempts: 'attemptBoth' });
  return resultat && resultat.data ? resultat.data : '';
}

// Quatre zones qui se chevauchent, couvrant chacune ~60 % de la photo.
function quarts(image) {
  const w = Math.round(image.width * 0.6);
  const h = Math.round(image.height * 0.6);
  const x2 = image.width - w;
  const y2 = image.height - h;
  return [
    { x: 0, y: 0, w, h },
    { x: x2, y: 0, w, h },
    { x: 0, y: y2, w, h },
    { x: x2, y: y2, w, h },
  ];
}

function fabriqueVignette(image) {
  const facteur = Math.min(1, 128 / Math.max(image.width, image.height));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(image.width * facteur));
  c.height = Math.max(1, Math.round(image.height * facteur));
  c.getContext('2d').drawImage(image, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.6);
}

// Le QR contient normalement le prénom tel quel. On accepte aussi les formes
// « prenom:Léa » ou une adresse du type « …?prenom=Léa ».
function extraitPrenom(brut) {
  let valeur = String(brut).trim();
  const parametre = valeur.match(/[?&](?:prenom|pr%C3%A9nom|nom|name)=([^&#]+)/i);
  if (parametre) {
    valeur = decodeURIComponent(parametre[1].replace(/\+/g, ' '));
  } else {
    valeur = valeur.replace(/^(?:prenom|prénom|nom|name|eleve|élève)\s*[:=]\s*/i, '');
  }
  return valeur.trim();
}

// ---------------------------------------------------------------- tableau

function creerLigne({ file, nomOrigine, prenom, vignette, statut }) {
  const tr = document.createElement('tr');

  const tdVignette = document.createElement('td');
  if (vignette) {
    const img = document.createElement('img');
    img.src = vignette;
    img.alt = '';
    tdVignette.appendChild(img);
  }

  const tdOrigine = document.createElement('td');
  tdOrigine.className = 'origine';
  tdOrigine.textContent = nomOrigine;

  const tdPrenom = document.createElement('td');
  const champ = document.createElement('input');
  champ.type = 'text';
  champ.value = prenom;
  champ.size = 14;
  tdPrenom.appendChild(champ);

  const tdCible = document.createElement('td');
  tdCible.className = 'cible';

  const tdEtat = document.createElement('td');

  tr.append(tdVignette, tdOrigine, tdPrenom, tdCible, tdEtat);
  el.resultats.appendChild(tr);

  const ligne = {
    file, nomOrigine, statut, tr, champ, tdCible, tdEtat,
    date: dateDuFichier(file),
    ext: extension(nomOrigine),
    numero: 1,
    nomCible: '',
    copiee: false,
    get prenom() { return champ.value.trim(); },
  };

  champ.addEventListener('input', () => {
    ligne.statut = ligne.prenom ? 'ok' : 'manquant';
    ligne.copiee = false;
    recalculerNoms();
    majBoutonCopier();
  });

  return ligne;
}

function recalculerNoms() {
  const compteurs = new Map();
  for (const ligne of etat.lignes) {
    const prenom = nettoiePourFichier(ligne.prenom);
    if (ligne.prenom) {
      // Sans la date dans le nom, le numéro doit continuer d'un jour à l'autre.
      const cle = el.modele.value === 'prenom_num' ? prenom : `${prenom}|${ligne.date}`;
      const n = (compteurs.get(cle) || 0) + 1;
      compteurs.set(cle, n);
      ligne.numero = n;
      ligne.nomCible = nomFichier(prenom, ligne.date, n, ligne.ext);
    } else {
      ligne.numero = 1;
      ligne.nomCible = '';
    }
    afficheLigne(ligne);
  }
}

function nomFichier(prenom, date, numero, ext) {
  const n = String(numero).padStart(2, '0');
  let base;
  switch (el.modele.value) {
    case 'prenom_num': base = `${prenom}_${n}`; break;
    case 'date_prenom_num': base = `${date}_${prenom}_${n}`; break;
    default: base = `${prenom}_${date}_${n}`;
  }
  return `${base}.${ext}`;
}

function afficheLigne(ligne) {
  const dossier = el.sousDossiers.checked && ligne.prenom
    ? `${nettoiePourFichier(ligne.prenom)}\\`
    : '';
  ligne.tdCible.textContent = ligne.nomCible ? dossier + ligne.nomCible : '—';

  ligne.tr.classList.toggle('manquant', ligne.statut === 'manquant');
  ligne.tr.classList.toggle('erreur', ligne.statut === 'erreur');

  if (ligne.copiee) {
    ligne.tdEtat.textContent = 'copiée';
    ligne.tdEtat.className = 'etat-ok';
  } else if (ligne.statut === 'erreur') {
    ligne.tdEtat.textContent = EXTENSIONS_CONNUES.includes(ligne.ext) && !EXTENSIONS_LUES.includes(ligne.ext)
      ? 'format HEIC non lisible'
      : 'photo illisible';
    ligne.tdEtat.className = 'etat-erreur';
  } else if (ligne.statut === 'manquant') {
    ligne.tdEtat.textContent = 'QR non trouvé';
    ligne.tdEtat.className = 'etat-manquant';
  } else {
    ligne.tdEtat.textContent = 'prêt';
    ligne.tdEtat.className = '';
  }
}

function remplirLesVides() {
  let dernier = '';
  for (const ligne of etat.lignes) {
    if (ligne.prenom) dernier = ligne.prenom;
    else if (dernier && ligne.statut !== 'erreur') {
      ligne.champ.value = dernier;
      ligne.statut = 'ok';
    }
  }
  recalculerNoms();
  majBoutonCopier();
}

function majBoutonCopier() {
  const aCopier = etat.lignes.some((l) => l.prenom && !l.copiee);
  const destinationPrete = !supporteDossiers || etat.dossierDestination !== null;
  el.copier.disabled = !(etat.analyseFaite && aCopier && destinationPrete);
}

// ---------------------------------------------------------------- copie

async function copier() {
  const aFaire = etat.lignes.filter((l) => l.prenom && !l.copiee);
  if (aFaire.length === 0) return;

  el.copier.disabled = true;
  el.progressionCopie.hidden = false;
  el.progressionCopie.max = aFaire.length;
  el.progressionCopie.value = 0;

  let copiees = 0;
  let echecs = 0;

  for (const ligne of aFaire) {
    try {
      if (supporteDossiers) await copierDansDossier(ligne);
      else await telecharger(ligne);
      ligne.copiee = true;
      copiees++;
    } catch (e) {
      ligne.statut = 'erreur';
      echecs++;
      console.error(e);
    }
    afficheLigne(ligne);
    el.progressionCopie.value = copiees + echecs;
  }

  el.progressionCopie.hidden = true;
  el.etatCopie.textContent = echecs
    ? `${copiees} photo(s) copiée(s), ${echecs} en échec.`
    : `${copiees} photo(s) copiée(s).`;
  majBoutonCopier();
}

async function copierDansDossier(ligne) {
  const prenom = nettoiePourFichier(ligne.prenom);
  const dossier = el.sousDossiers.checked
    ? await etat.dossierDestination.getDirectoryHandle(prenom, { create: true })
    : etat.dossierDestination;

  // On repart du numéro affiché puis on avance tant qu'un fichier du même nom
  // existe déjà : relancer le rangement deux fois n'écrase jamais rien.
  let numero = ligne.numero;
  let nom = nomFichier(prenom, ligne.date, numero, ligne.ext);
  while (numero < 999 && await existeDeja(dossier, nom)) {
    numero++;
    nom = nomFichier(prenom, ligne.date, numero, ligne.ext);
  }

  const cible = await dossier.getFileHandle(nom, { create: true });
  const flux = await cible.createWritable();
  await flux.write(ligne.file);
  await flux.close();

  ligne.numero = numero;
  ligne.nomCible = nom;
}

async function existeDeja(dossier, nom) {
  try {
    await dossier.getFileHandle(nom);
    return true;
  } catch (e) {
    return false;
  }
}

async function telecharger(ligne) {
  const url = URL.createObjectURL(ligne.file);
  const lien = document.createElement('a');
  lien.href = url;
  lien.download = ligne.nomCible;
  document.body.appendChild(lien);
  lien.click();
  lien.remove();
  // Le navigateur refuse les téléchargements trop rapprochés.
  await new Promise((suite) => setTimeout(suite, 300));
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------- outils

function estImage(nom) {
  return EXTENSIONS_CONNUES.includes(extension(nom));
}

function extension(nom) {
  const point = nom.lastIndexOf('.');
  return point === -1 ? '' : nom.slice(point + 1).toLowerCase();
}

function dateDuFichier(file) {
  const d = new Date(file.lastModified);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// Retire les caractères interdits dans un nom de fichier Windows.
function nettoiePourFichier(texte) {
  const propre = String(texte)
    .replace(/[<>:"\/\\|?*\u0000-\u001f]/g, '')
    .replace(/\s+/g, '-')
    .replace(/^[.\-\s]+|[.\-\s]+$/g, '')
    .slice(0, 60);
  return propre || 'Sans-nom';
}

function message(texte, alerte) {
  const div = document.createElement('div');
  div.className = alerte ? 'message alerte' : 'message';
  div.textContent = texte;
  el.avertissement.appendChild(div);
}
