// Page « Ranger les photos » : lecture des QR codes d'un dossier, vérification
// dans un tableau, puis copie renommée vers le dossier de destination.

import './style.css';
import { lirePhoto } from './lecture-qr';
import {
  dateDuFichier,
  estImage,
  estLisible,
  extension,
  extraitPrenom,
  nettoiePourFichier,
  type Modele,
} from './noms';
import { nomLibre, planifie, type Entree } from './rangement';

// --- API File System Access -------------------------------------------------
// Non typée par lib.dom : on décrit juste ce qu'on utilise.

interface OptionsSelecteur {
  id?: string;
  mode?: 'read' | 'readwrite';
}
type Selecteur = (options?: OptionsSelecteur) => Promise<Dossier>;

interface Dossier {
  readonly name: string;
  values(): AsyncIterable<{ kind: string; name: string; getFile(): Promise<File> }>;
  getDirectoryHandle(nom: string, options?: { create?: boolean }): Promise<Dossier>;
  getFileHandle(nom: string, options?: { create?: boolean }): Promise<{
    createWritable(): Promise<{ write(donnees: Blob): Promise<void>; close(): Promise<void> }>;
  }>;
}

const selecteurDossier = (window as unknown as { showDirectoryPicker?: Selecteur })
  .showDirectoryPicker;
const supporteDossiers = typeof selecteurDossier === 'function';

// --- État -------------------------------------------------------------------

interface Ligne {
  readonly fichier: File;
  readonly nomOrigine: string;
  readonly date: string;
  readonly ext: string;
  readonly champ: HTMLInputElement;
  readonly tr: HTMLTableRowElement;
  readonly tdCible: HTMLTableCellElement;
  readonly tdEtat: HTMLTableCellElement;
  statut: 'ok' | 'manquant' | 'erreur';
  numero: number;
  nomCible: string;
  copiee: boolean;
}

const prenomDe = (ligne: Ligne): string => ligne.champ.value.trim();
// Un prénom vide reste vide : `nettoiePourFichier` renverrait « Sans-nom »,
// et la ligne se retrouverait planifiée alors qu'elle ne doit pas être copiée.
const entreeDe = (ligne: Ligne): Entree => {
  const brut = prenomDe(ligne);
  return {
    prenom: brut ? nettoiePourFichier(brut) : '',
    date: ligne.date,
    ext: ligne.ext,
  };
};

let fichiers: { file: File; nomOrigine: string }[] = [];
let lignes: Ligne[] = [];
let dossierDestination: Dossier | null = null;
let analyseFaite = false;

// --- Éléments ---------------------------------------------------------------

function requis<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Élément « ${id} » introuvable`);
  return element as T;
}

const el = {
  avertissement: requis<HTMLDivElement>('avertissement'),
  choisirSource: requis<HTMLButtonElement>('choisir-source'),
  nomSource: requis<HTMLSpanElement>('nom-source'),
  choisirDestination: requis<HTMLButtonElement>('choisir-destination'),
  nomDestination: requis<HTMLSpanElement>('nom-destination'),
  sourceSecours: requis<HTMLInputElement>('source-secours'),
  sousDossiers: requis<HTMLInputElement>('sous-dossiers'),
  modele: requis<HTMLSelectElement>('modele'),
  analyser: requis<HTMLButtonElement>('analyser'),
  remplir: requis<HTMLButtonElement>('remplir'),
  progression: requis<HTMLProgressElement>('progression'),
  etatAnalyse: requis<HTMLParagraphElement>('etat-analyse'),
  blocResultats: requis<HTMLElement>('bloc-resultats'),
  resultats: requis<HTMLTableSectionElement>('resultats'),
  copier: requis<HTMLButtonElement>('copier'),
  etatCopie: requis<HTMLSpanElement>('etat-copie'),
  progressionCopie: requis<HTMLProgressElement>('progression-copie'),
};

const modeleChoisi = (): Modele => el.modele.value as Modele;

// --- Démarrage --------------------------------------------------------------

if (!supporteDossiers) {
  message(
    'Ce navigateur ne sait pas écrire directement dans un dossier. Les photos renommées ' +
    'arriveront une par une dans votre dossier « Téléchargements ». Pour un rangement ' +
    'automatique, utilisez Microsoft Edge ou Google Chrome.',
  );
  el.choisirDestination.disabled = true;
  el.nomDestination.textContent = 'dossier « Téléchargements »';
  el.sousDossiers.checked = false;
  el.sousDossiers.disabled = true;
  el.copier.textContent = 'Télécharger les photos renommées';
}

el.choisirSource.addEventListener('click', () => void choisirSource());
el.choisirDestination.addEventListener('click', () => void choisirDestination());
el.sourceSecours.addEventListener('change', () => {
  const choisis = [...(el.sourceSecours.files ?? [])].filter((f) => estImage(f.name));
  chargerFichiers(choisis.map((f) => ({ file: f, nomOrigine: f.name })), 'dossier choisi');
});
el.analyser.addEventListener('click', () => void analyser());
el.remplir.addEventListener('click', remplirLesVides);
el.copier.addEventListener('click', () => void copier());
el.modele.addEventListener('change', recalculerNoms);
el.sousDossiers.addEventListener('change', recalculerNoms);

// --- Choix des dossiers -----------------------------------------------------

async function choisirSource(): Promise<void> {
  if (!selecteurDossier) {
    el.sourceSecours.click();
    return;
  }

  let dossier: Dossier;
  try {
    dossier = await selecteurDossier({ id: 'photos-source', mode: 'read' });
  } catch {
    return; // annulé
  }

  const entrees: { name: string; getFile(): Promise<File> }[] = [];
  for await (const entree of dossier.values()) {
    if (entree.kind === 'file' && estImage(entree.name)) entrees.push(entree);
  }
  entrees.sort((a, b) => a.name.localeCompare(b.name, 'fr', { numeric: true }));

  const trouves: { file: File; nomOrigine: string }[] = [];
  for (const entree of entrees) {
    trouves.push({ file: await entree.getFile(), nomOrigine: entree.name });
  }
  chargerFichiers(trouves, dossier.name);
}

async function choisirDestination(): Promise<void> {
  if (!selecteurDossier) return;
  try {
    dossierDestination = await selecteurDossier({
      id: 'photos-destination',
      mode: 'readwrite',
    });
  } catch {
    return;
  }
  el.nomDestination.textContent = dossierDestination.name;
  majBoutonCopier();
}

function chargerFichiers(trouves: { file: File; nomOrigine: string }[], nomDossier: string): void {
  fichiers = trouves;
  lignes = [];
  analyseFaite = false;
  el.resultats.textContent = '';
  el.blocResultats.hidden = true;
  el.nomSource.textContent = `${nomDossier} — ${trouves.length} photo(s)`;
  el.analyser.disabled = trouves.length === 0;
  el.etatAnalyse.textContent = trouves.length === 0 ? 'Aucune image trouvée dans ce dossier.' : '';
}

// --- Analyse ----------------------------------------------------------------

async function analyser(): Promise<void> {
  el.analyser.disabled = true;
  el.copier.disabled = true;
  el.etatCopie.textContent = '';
  el.resultats.textContent = '';
  lignes = [];
  el.blocResultats.hidden = false;
  el.progression.hidden = false;
  el.progression.max = fichiers.length;
  el.progression.value = 0;

  let trouves = 0;
  for (const [index, { file, nomOrigine }] of fichiers.entries()) {
    el.etatAnalyse.textContent = `Lecture de ${nomOrigine} (${index + 1}/${fichiers.length})…`;

    let prenom = '';
    let vignette = '';
    let statut: Ligne['statut'] = 'manquant';

    if (!estLisible(nomOrigine)) {
      statut = 'erreur';
    } else {
      try {
        const lu = await lirePhoto(file);
        vignette = lu.vignette;
        prenom = lu.texte ? extraitPrenom(lu.texte) : '';
        if (prenom) {
          statut = 'ok';
          trouves++;
        }
      } catch {
        statut = 'erreur';
      }
    }

    lignes.push(creerLigne(file, nomOrigine, prenom, vignette, statut));
    el.progression.value = index + 1;
  }

  el.progression.hidden = true;
  el.analyser.disabled = false;
  el.remplir.disabled = false;
  analyseFaite = true;
  el.etatAnalyse.textContent =
    `${trouves} prénom(s) reconnu(s) sur ${fichiers.length} photo(s).`;
  recalculerNoms();
  majBoutonCopier();
}

// --- Tableau ----------------------------------------------------------------

function creerLigne(
  fichier: File,
  nomOrigine: string,
  prenom: string,
  vignette: string,
  statut: Ligne['statut'],
): Ligne {
  const tr = document.createElement('tr');
  tr.className = 'border-b border-slate-200';

  const tdVignette = cellule('px-2 py-1');
  if (vignette) {
    const img = document.createElement('img');
    img.src = vignette;
    img.alt = '';
    img.className = 'size-16 rounded object-cover bg-slate-200';
    tdVignette.append(img);
  }

  const tdOrigine = cellule('px-2 py-1 text-[0.85rem] break-all text-slate-500');
  tdOrigine.textContent = nomOrigine;

  const tdPrenom = cellule('px-2 py-1');
  const champ = document.createElement('input');
  champ.type = 'text';
  champ.value = prenom;
  champ.size = 14;
  champ.className = 'champ';
  champ.setAttribute('aria-label', `Prénom pour ${nomOrigine}`);
  tdPrenom.append(champ);

  const tdCible = cellule('px-2 py-1 font-mono text-[0.85rem] break-all');
  const tdEtat = cellule('px-2 py-1');

  tr.append(tdVignette, tdOrigine, tdPrenom, tdCible, tdEtat);
  el.resultats.append(tr);

  const ligne: Ligne = {
    fichier,
    nomOrigine,
    date: dateDuFichier(fichier.lastModified),
    ext: extension(nomOrigine),
    champ,
    tr,
    tdCible,
    tdEtat,
    statut,
    numero: 1,
    nomCible: '',
    copiee: false,
  };

  champ.addEventListener('input', () => {
    ligne.statut = prenomDe(ligne) ? 'ok' : 'manquant';
    ligne.copiee = false;
    recalculerNoms();
    majBoutonCopier();
  });

  return ligne;
}

function cellule(classe: string): HTMLTableCellElement {
  const td = document.createElement('td');
  td.className = classe;
  return td;
}

function recalculerNoms(): void {
  const plans = planifie(lignes.map(entreeDe), modeleChoisi());
  for (const [index, ligne] of lignes.entries()) {
    const plan = plans[index];
    ligne.numero = plan?.numero ?? 1;
    ligne.nomCible = plan?.nom ?? '';
    afficheLigne(ligne);
  }
}

function afficheLigne(ligne: Ligne): void {
  const dossier = el.sousDossiers.checked && ligne.nomCible
    ? `${nettoiePourFichier(prenomDe(ligne))}\\`
    : '';
  ligne.tdCible.textContent = ligne.nomCible ? dossier + ligne.nomCible : '—';

  ligne.tr.classList.toggle('bg-amber-50', !ligne.copiee && ligne.statut === 'manquant');
  ligne.tr.classList.toggle('bg-red-50', ligne.statut === 'erreur');

  const [texte, classe] = etatLigne(ligne);
  ligne.tdEtat.textContent = texte;
  ligne.tdEtat.className = `px-2 py-1 ${classe}`;
}

function etatLigne(ligne: Ligne): [string, string] {
  if (ligne.copiee) return ['copiée', 'text-green-700'];
  if (ligne.statut === 'erreur') {
    return estImage(ligne.nomOrigine) && !estLisible(ligne.nomOrigine)
      ? ['format HEIC non lisible', 'text-red-700']
      : ['photo illisible', 'text-red-700'];
  }
  if (ligne.statut === 'manquant') return ['QR non trouvé', 'text-amber-700'];
  return ['prêt', ''];
}

function remplirLesVides(): void {
  let dernier = '';
  for (const ligne of lignes) {
    if (prenomDe(ligne)) {
      dernier = prenomDe(ligne);
    } else if (dernier && ligne.statut !== 'erreur') {
      ligne.champ.value = dernier;
      ligne.statut = 'ok';
    }
  }
  recalculerNoms();
  majBoutonCopier();
}

function majBoutonCopier(): void {
  const resteAFaire = lignes.some((ligne) => prenomDe(ligne) && !ligne.copiee);
  const destinationPrete = !supporteDossiers || dossierDestination !== null;
  el.copier.disabled = !(analyseFaite && resteAFaire && destinationPrete);
}

// --- Copie ------------------------------------------------------------------

async function copier(): Promise<void> {
  const aFaire = lignes.filter((ligne) => prenomDe(ligne) && !ligne.copiee);
  if (aFaire.length === 0) return;

  el.copier.disabled = true;
  el.progressionCopie.hidden = false;
  el.progressionCopie.max = aFaire.length;
  el.progressionCopie.value = 0;

  let copiees = 0;
  let echecs = 0;

  for (const ligne of aFaire) {
    try {
      if (dossierDestination) await copierDansDossier(ligne, dossierDestination);
      else await telecharger(ligne);
      ligne.copiee = true;
      copiees++;
    } catch (erreur) {
      ligne.statut = 'erreur';
      echecs++;
      console.error(erreur);
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

async function copierDansDossier(ligne: Ligne, destination: Dossier): Promise<void> {
  const entree = entreeDe(ligne);
  const dossier = el.sousDossiers.checked
    ? await destination.getDirectoryHandle(entree.prenom, { create: true })
    : destination;

  const { nom, numero } = await nomLibre(
    modeleChoisi(),
    entree,
    ligne.numero,
    (candidat) => existeDeja(dossier, candidat),
  );

  const cible = await dossier.getFileHandle(nom, { create: true });
  const flux = await cible.createWritable();
  await flux.write(ligne.fichier);
  await flux.close();

  ligne.numero = numero;
  ligne.nomCible = nom;
}

async function existeDeja(dossier: Dossier, nom: string): Promise<boolean> {
  try {
    await dossier.getFileHandle(nom);
    return true;
  } catch {
    return false;
  }
}

async function telecharger(ligne: Ligne): Promise<void> {
  const url = URL.createObjectURL(ligne.fichier);
  const lien = document.createElement('a');
  lien.href = url;
  lien.download = ligne.nomCible;
  document.body.append(lien);
  lien.click();
  lien.remove();
  // Le navigateur refuse les téléchargements trop rapprochés.
  await new Promise((suite) => setTimeout(suite, 300));
  URL.revokeObjectURL(url);
}

// --- Divers -----------------------------------------------------------------

function message(texte: string): void {
  const div = document.createElement('div');
  div.className = 'mb-4 rounded-lg bg-blue-50 px-4 py-3';
  div.textContent = texte;
  el.avertissement.append(div);
}
