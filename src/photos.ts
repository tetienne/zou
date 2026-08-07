// Page « Ranger les photos » : lecture des QR codes d'un dossier, vérification
// dans une galerie, puis copie renommée vers le dossier de destination.

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
import { requis } from './dom';

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
  getFileHandle(
    nom: string,
    options?: { create?: boolean },
  ): Promise<{
    createWritable(): Promise<{ write(donnees: Blob): Promise<void>; close(): Promise<void> }>;
  }>;
}

const selecteurDossier = (window as unknown as { showDirectoryPicker?: Selecteur })
  .showDirectoryPicker;
const supporteDossiers = typeof selecteurDossier === 'function';

// --- Mémoire du navigateur --------------------------------------------------

const CLE_PRENOMS = 'qr-school.prenoms';
const CLE_TAILLE = 'qr-school.taille';

// --- État -------------------------------------------------------------------

interface Ligne {
  readonly fichier: File;
  readonly nomOrigine: string;
  readonly date: string;
  readonly ext: string;
  /** Faux pour les HEIC/HEIF : le navigateur ne sait pas les afficher. */
  readonly lisible: boolean;
  readonly champ: HTMLInputElement;
  readonly carte: HTMLElement;
  readonly zoneNom: HTMLParagraphElement;
  readonly zoneEtat: HTMLParagraphElement;
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

const el = {
  avertissement: requis('avertissement', HTMLDivElement),
  choisirSource: requis('choisir-source', HTMLButtonElement),
  nomSource: requis('nom-source', HTMLSpanElement),
  choisirDestination: requis('choisir-destination', HTMLButtonElement),
  nomDestination: requis('nom-destination', HTMLSpanElement),
  sourceSecours: requis('source-secours', HTMLInputElement),
  sousDossiers: requis('sous-dossiers', HTMLInputElement),
  modele: requis('modele', HTMLSelectElement),
  analyser: requis('analyser', HTMLButtonElement),
  progression: requis('progression', HTMLProgressElement),
  etatAnalyse: requis('etat-analyse', HTMLParagraphElement),
  blocResultats: requis('bloc-resultats', HTMLElement),
  resultats: requis('resultats', HTMLDivElement),
  aCorriger: requis('a-corriger', HTMLDivElement),
  aCorrigerTexte: requis('a-corriger-texte', HTMLSpanElement),
  toutPret: requis('tout-pret', HTMLParagraphElement),
  recapitulatif: requis('recapitulatif', HTMLParagraphElement),
  prenomsConnus: requis('prenoms-connus', HTMLDataListElement),
  copier: requis('copier', HTMLButtonElement),
  etatCopie: requis('etat-copie', HTMLSpanElement),
  progressionCopie: requis('progression-copie', HTMLProgressElement),
};

const modeleChoisi = (): Modele => el.modele.value as Modele;

// --- Petites icônes (jamais la couleur seule) -------------------------------

const CHEMINS: Record<string, string> = {
  pret: '<path d="m20 6-11 11-5-5"/>',
  alerte:
    '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>' +
    '<path d="M12 9v4"/><path d="M12 17h.01"/>',
  interdit: '<circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/>',
  copiee: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
};

function icone(nom: string, classe: string): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', classe);
  svg.innerHTML = CHEMINS[nom] ?? '';
  return svg;
}

// --- Taille des photos (mémorisée d'une semaine sur l'autre) ----------------

const CLASSES_TAILLE: Record<string, string> = {
  petites: 'galerie-petites',
  moyennes: 'galerie-moyennes',
  grandes: 'galerie-grandes',
};

const radiosTaille = [...document.querySelectorAll<HTMLInputElement>('input[name="taille"]')];

function appliqueTaille(valeur: string): void {
  el.resultats.className = `galerie ${CLASSES_TAILLE[valeur] ?? 'galerie-moyennes'}`;
}

const tailleMemorisee = localStorage.getItem(CLE_TAILLE) ?? '';
const taille = radiosTaille.some((radio) => radio.value === tailleMemorisee)
  ? tailleMemorisee
  : 'moyennes';

for (const radio of radiosTaille) {
  radio.checked = radio.value === taille;
  radio.addEventListener('change', () => {
    if (!radio.checked) return;
    localStorage.setItem(CLE_TAILLE, radio.value);
    appliqueTaille(radio.value);
  });
}
appliqueTaille(taille);

// --- Prénoms proposés : la classe d'abord, puis ceux lus sur les photos -----

function majPrenomsConnus(): void {
  const classe = (localStorage.getItem(CLE_PRENOMS) ?? '')
    .split('\n')
    .map((ligne) => ligne.trim())
    .filter(Boolean);
  const lus = lignes.map(prenomDe).filter(Boolean);

  const vus = new Set<string>();
  el.prenomsConnus.textContent = '';
  for (const prenom of [...classe, ...lus]) {
    const cle = prenom.toLocaleLowerCase('fr');
    if (vus.has(cle)) continue;
    vus.add(cle);
    const option = document.createElement('option');
    option.value = prenom;
    el.prenomsConnus.append(option);
  }
}

majPrenomsConnus();

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
  chargerFichiers(
    choisis.map((f) => ({ file: f, nomOrigine: f.name })),
    'dossier choisi',
  );
});
el.analyser.addEventListener('click', () => void analyser());
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
  el.aCorriger.hidden = true;
  el.toutPret.hidden = true;
  el.recapitulatif.textContent = '';
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
  analyseFaite = true;
  el.etatAnalyse.textContent = `${trouves} prénom(s) reconnu(s) sur ${fichiers.length} photo(s).`;
  majPrenomsConnus();
  recalculerNoms();
  trier();
  majBoutonCopier();
}

// --- Galerie ----------------------------------------------------------------

function creerLigne(
  fichier: File,
  nomOrigine: string,
  prenom: string,
  vignette: string,
  statut: Ligne['statut'],
): Ligne {
  const carte = document.createElement('article');
  carte.className = 'carte-photo';

  const zoneImage = document.createElement('div');
  zoneImage.className = 'carte-photo-image';
  if (vignette) {
    const img = document.createElement('img');
    img.src = vignette;
    img.alt = '';
    img.loading = 'lazy';
    img.className = 'size-full object-contain';
    zoneImage.append(img);
  } else {
    const vide = document.createElement('p');
    vide.className =
      'flex size-full flex-col items-center justify-center gap-2 px-3 text-center ' +
      'text-[0.85rem] text-slate-600';
    vide.append(icone('interdit', 'size-7 text-slate-500'), 'Aperçu impossible');
    zoneImage.append(vide);
  }

  const bas = document.createElement('div');
  bas.className = 'flex flex-1 flex-col gap-2 border-t border-slate-200 p-3';

  const champ = document.createElement('input');
  champ.type = 'text';
  champ.value = prenom;
  champ.placeholder = 'Prénom';
  champ.autocomplete = 'off';
  champ.className = 'champ w-full text-[1.05rem]';
  champ.setAttribute('list', 'prenoms-connus');
  champ.setAttribute('aria-label', `Prénom pour ${nomOrigine}`);

  const zoneNom = document.createElement('p');
  const zoneEtat = document.createElement('p');

  const origine = document.createElement('p');
  origine.className = 'mt-auto pt-1 text-[0.8rem] break-all text-slate-500';
  origine.textContent = nomOrigine;

  bas.append(champ, zoneNom, zoneEtat, origine);
  carte.append(zoneImage, bas);
  el.resultats.append(carte);

  const ligne: Ligne = {
    fichier,
    nomOrigine,
    date: dateDuFichier(fichier.lastModified),
    ext: extension(nomOrigine),
    lisible: estLisible(nomOrigine),
    champ,
    carte,
    zoneNom,
    zoneEtat,
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
  // Le reclassement attend la fin de la saisie : déplacer la carte à chaque
  // lettre ferait sauter la photo sous les doigts de la maîtresse.
  champ.addEventListener('change', trier);

  return ligne;
}

function recalculerNoms(): void {
  const plans = planifie(lignes.map(entreeDe), modeleChoisi());
  for (const [index, ligne] of lignes.entries()) {
    const plan = plans[index];
    ligne.numero = plan?.numero ?? 1;
    ligne.nomCible = plan?.nom ?? '';
    afficheLigne(ligne);
  }
  majRecapitulatif();
}

function afficheLigne(ligne: Ligne): void {
  const dossier =
    el.sousDossiers.checked && ligne.nomCible ? `${nettoiePourFichier(prenomDe(ligne))}\\` : '';

  if (ligne.nomCible) {
    ligne.zoneNom.className = 'font-mono text-[0.85rem] break-all text-slate-700';
    ligne.zoneNom.textContent = dossier + ligne.nomCible;
  } else {
    ligne.zoneNom.className = 'text-[0.85rem] text-amber-900';
    ligne.zoneNom.textContent = 'Pas encore de nom de fichier';
  }

  const etat = etatLigne(ligne);
  ligne.carte.className = `carte-photo ${etat.carte}`.trim();
  ligne.zoneEtat.className = `etat-pastille ${etat.pastille}`;
  ligne.zoneEtat.textContent = '';
  ligne.zoneEtat.append(icone(etat.icone, 'size-4 shrink-0'), etat.texte);
}

interface Etat {
  texte: string;
  icone: string;
  pastille: string;
  carte: string;
}

function etatLigne(ligne: Ligne): Etat {
  if (ligne.copiee) {
    return {
      texte: 'Copiée',
      icone: 'copiee',
      pastille: 'bg-green-100 text-green-900',
      carte: 'carte-photo-copiee',
    };
  }
  if (!prenomDe(ligne)) {
    if (!ligne.lisible || ligne.statut === 'erreur') {
      return {
        texte: ligne.lisible ? 'Photo illisible' : 'Format HEIC, non lisible',
        icone: 'interdit',
        pastille: 'bg-red-100 text-red-900',
        carte: 'carte-photo-erreur',
      };
    }
    return {
      texte: 'QR non trouvé',
      icone: 'alerte',
      pastille: 'bg-amber-100 text-amber-900',
      carte: 'carte-photo-alerte',
    };
  }
  if (ligne.statut === 'erreur' && ligne.lisible) {
    return {
      texte: 'Copie impossible',
      icone: 'interdit',
      pastille: 'bg-red-100 text-red-900',
      carte: 'carte-photo-erreur',
    };
  }
  return {
    texte: 'Prêt à copier',
    icone: 'pret',
    pastille: 'bg-slate-200 text-slate-800',
    carte: '',
  };
}

/**
 * Les photos sans prénom passent en tête : ce sont les seules qui demandent
 * quelque chose à la maîtresse. L'ordre d'origine est conservé à l'intérieur
 * de chaque groupe, et `lignes` n'est jamais réordonné (la numérotation suit
 * l'ordre des photos, pas l'ordre d'affichage).
 */
function trier(): void {
  const ordre = [
    ...lignes.filter((ligne) => !prenomDe(ligne)),
    ...lignes.filter((ligne) => prenomDe(ligne)),
  ];
  if (ordre.every((ligne, index) => el.resultats.children[index] === ligne.carte)) return;

  const actif = document.activeElement;
  const champActif = actif instanceof HTMLInputElement ? actif : null;
  const curseur = champActif?.selectionStart ?? null;

  for (const ligne of ordre) el.resultats.append(ligne.carte);

  if (champActif?.isConnected) {
    champActif.focus();
    if (curseur !== null) champActif.setSelectionRange(curseur, curseur);
  }
}

function majRecapitulatif(): void {
  let pretes = 0;
  let sansPrenom = 0;
  let illisibles = 0;
  let copiees = 0;

  for (const ligne of lignes) {
    if (ligne.copiee) copiees++;
    else if (prenomDe(ligne)) pretes++;
    else if (!ligne.lisible || ligne.statut === 'erreur') illisibles++;
    else sansPrenom++;
  }

  const s = (n: number): string => (n > 1 ? 's' : '');
  const morceaux: string[] = [];
  if (pretes) morceaux.push(`${pretes} prête${s(pretes)} à copier`);
  if (sansPrenom) morceaux.push(`${sansPrenom} sans prénom`);
  if (illisibles) morceaux.push(`${illisibles} illisible${s(illisibles)}`);
  if (copiees) morceaux.push(`${copiees} copiée${s(copiees)}`);

  el.recapitulatif.textContent = lignes.length
    ? `${lignes.length} photo${s(lignes.length)} : ${morceaux.join(' · ')}`
    : '';

  const aCorriger = sansPrenom + illisibles;
  el.aCorriger.hidden = aCorriger === 0;
  el.aCorrigerTexte.textContent =
    aCorriger === 1
      ? '1 photo n’a pas encore de prénom.'
      : `${aCorriger} photos n’ont pas encore de prénom.`;
  el.toutPret.hidden = !analyseFaite || aCorriger > 0 || lignes.length === 0;
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
  majRecapitulatif();
  majBoutonCopier();
}

async function copierDansDossier(ligne: Ligne, destination: Dossier): Promise<void> {
  const entree = entreeDe(ligne);
  const dossier = el.sousDossiers.checked
    ? await destination.getDirectoryHandle(entree.prenom, { create: true })
    : destination;

  const { nom, numero } = await nomLibre(modeleChoisi(), entree, ligne.numero, (candidat) =>
    existeDeja(dossier, candidat),
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
