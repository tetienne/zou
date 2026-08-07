// "Ranger les photos" page: read the QR codes of a folder, check them in a
// gallery, then copy the photos out under their new names.

import './style.css';
import { scanPhotos as readFolder, type ScannedPhoto } from './photo-scanning';
import {
  buildFileName,
  extension,
  extractFirstName,
  fileDate,
  isImage,
  isReadable,
  sanitiseForFileName,
  type NamePattern,
} from './names';
import { findFreeFileName, planFileNames, type PhotoEntry } from './filing';
import { required } from './dom';
import { directoryPicker as folderPicker, supportsFolders, type Directory } from './folder-access';
import { forgetFolder, grantAccess, recallFolder, rememberFolder } from './folder-memory';

const directoryPicker = folderPicker();
const supportsDirectories = supportsFolders();

// --- Browser storage --------------------------------------------------------

// The old name, kept on purpose — see the note in labels.ts. `names` is the
// very key the labels page writes, which is how the class list reaches the
// autocompletion here.
const NAMES_STORAGE_KEY = 'qr-school.names';
const SIZE_STORAGE_KEY = 'qr-school.size';

// --- State ------------------------------------------------------------------

interface Row {
  readonly file: File;
  readonly originalName: string;
  readonly date: string;
  readonly ext: string;
  /** False for HEIC/HEIF: the browser cannot display them. */
  readonly readable: boolean;
  /** Object URL of the thumbnail, empty when there is none. Ours to release. */
  readonly thumbnail: string;
  readonly field: HTMLInputElement;
  readonly card: HTMLElement;
  readonly nameArea: HTMLParagraphElement;
  readonly statusArea: HTMLParagraphElement;
  status: 'ok' | 'missing' | 'error';
  index: number;
  targetName: string;
  copied: boolean;
}

const firstNameOf = (row: Row): string => row.field.value.trim();

/** French plural mark, for counts written into the interface. */
const plural = (n: number): string => (n > 1 ? 's' : '');

// An empty first name stays empty: `sanitiseForFileName` would return
// "Sans-nom" and the row would get planned even though it must not be copied.
const entryOf = (row: Row): PhotoEntry => {
  const typed = firstNameOf(row);
  return {
    firstName: typed ? sanitiseForFileName(typed) : '',
    date: row.date,
    ext: row.ext,
  };
};

let files: { file: File; originalName: string }[] = [];
let rows: Row[] = [];
let destination: Directory | null = null;
let scanDone = false;

// --- Elements ---------------------------------------------------------------

const el = {
  warning: required('warning', HTMLDivElement),
  chooseSource: required('choose-source', HTMLButtonElement),
  sourceName: required('source-name', HTMLSpanElement),
  sourceRecall: required('source-recall', HTMLParagraphElement),
  sourceRecallName: required('source-recall-name', HTMLSpanElement),
  sourceResume: required('source-resume', HTMLButtonElement),
  chooseDestination: required('choose-destination', HTMLButtonElement),
  destinationName: required('destination-name', HTMLSpanElement),
  destinationRecall: required('destination-recall', HTMLParagraphElement),
  destinationRecallName: required('destination-recall-name', HTMLSpanElement),
  destinationResume: required('destination-resume', HTMLButtonElement),
  fallbackSource: required('fallback-source', HTMLInputElement),
  subfolders: required('subfolders', HTMLInputElement),
  pattern: required('pattern', HTMLSelectElement),
  scan: required('scan', HTMLButtonElement),
  scanBlocked: required('scan-blocked', HTMLParagraphElement),
  scanProgress: required('scan-progress', HTMLProgressElement),
  scanStatus: required('scan-status', HTMLParagraphElement),
  resultsBlock: required('results-block', HTMLElement),
  results: required('results', HTMLDivElement),
  needsAttention: required('needs-attention', HTMLDivElement),
  needsAttentionText: required('needs-attention-text', HTMLSpanElement),
  heicNote: required('heic-note', HTMLParagraphElement),
  allReady: required('all-ready', HTMLParagraphElement),
  summary: required('summary', HTMLParagraphElement),
  knownNames: required('known-names', HTMLDataListElement),
  copy: required('copy', HTMLButtonElement),
  copyStatus: required('copy-status', HTMLSpanElement),
  copyBlocked: required('copy-blocked', HTMLParagraphElement),
  copyProgress: required('copy-progress', HTMLProgressElement),
};

const chosenPattern = (): NamePattern => el.pattern.value as NamePattern;

// --- Small icons (never colour alone) ---------------------------------------

const ICON_PATHS: Record<string, string> = {
  ready: '<path d="m20 6-11 11-5-5"/>',
  warning:
    '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>' +
    '<path d="M12 9v4"/><path d="M12 17h.01"/>',
  forbidden: '<circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/>',
  copied: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
};

function icon(name: string, className: string): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', className);
  svg.innerHTML = ICON_PATHS[name] ?? '';
  return svg;
}

// --- Thumbnail size (remembered from one week to the next) -------------------

const SIZE_CLASSES: Record<string, string> = {
  small: 'gallery-small',
  medium: 'gallery-medium',
  large: 'gallery-large',
};

const sizeRadios = [...document.querySelectorAll<HTMLInputElement>('input[name="size"]')];

function applySize(value: string): void {
  el.results.className = `gallery ${SIZE_CLASSES[value] ?? 'gallery-medium'}`;
}

const storedSize = localStorage.getItem(SIZE_STORAGE_KEY) ?? '';
const size = sizeRadios.some((radio) => radio.value === storedSize) ? storedSize : 'medium';

for (const radio of sizeRadios) {
  radio.checked = radio.value === size;
  radio.addEventListener('change', () => {
    if (!radio.checked) return;
    localStorage.setItem(SIZE_STORAGE_KEY, radio.value);
    applySize(radio.value);
  });
}
applySize(size);

// --- Suggested names: the class list first, then what the photos yielded -----

function refreshKnownNames(): void {
  const classList = (localStorage.getItem(NAMES_STORAGE_KEY) ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const fromPhotos = rows.map(firstNameOf).filter(Boolean);

  const seen = new Set<string>();
  el.knownNames.textContent = '';
  for (const firstName of [...classList, ...fromPhotos]) {
    const key = firstName.toLocaleLowerCase('fr');
    if (seen.has(key)) continue;
    seen.add(key);
    const option = document.createElement('option');
    option.value = firstName;
    el.knownNames.append(option);
  }
}

refreshKnownNames();

// --- Start-up ---------------------------------------------------------------

if (!supportsDirectories) {
  showWarning(
    'Ce navigateur ne sait pas écrire directement dans un dossier. Les photos renommées ' +
      'arriveront une par une dans votre dossier « Téléchargements ». Pour un rangement ' +
      'automatique, ouvrez cette page avec une version à jour de Google Chrome ou de ' +
      'Microsoft Edge. Brave bloque cette fonction, bien qu’il repose sur Chrome.',
  );
  el.chooseDestination.disabled = true;
  el.destinationName.textContent = 'dossier « Téléchargements »';
  el.subfolders.checked = false;
  el.subfolders.disabled = true;
  el.copy.textContent = 'Télécharger les photos renommées';
}

el.chooseSource.addEventListener('click', () => void chooseSource());
el.chooseDestination.addEventListener('click', () => void chooseDestination());
el.fallbackSource.addEventListener('change', () => {
  const chosen = [...(el.fallbackSource.files ?? [])].filter((file) => isImage(file.name));
  loadFiles(
    chosen.map((file) => ({ file, originalName: file.name })),
    'dossier choisi',
  );
});
el.scan.addEventListener('click', () => void scanPhotos());
el.copy.addEventListener('click', () => void copyPhotos());
el.pattern.addEventListener('change', recomputeNames);
el.subfolders.addEventListener('change', recomputeNames);

void offerRememberedFolders();

// --- Folder selection -------------------------------------------------------

async function chooseSource(): Promise<void> {
  if (!directoryPicker) {
    el.fallbackSource.click();
    return;
  }

  let directory: Directory;
  try {
    directory = await directoryPicker({ id: 'photos-source', mode: 'read' });
  } catch {
    return; // cancelled
  }

  el.sourceRecall.hidden = true;
  void rememberFolder('source', directory);
  await readSourceDirectory(directory);
}

async function readSourceDirectory(directory: Directory): Promise<void> {
  const entries: { name: string; getFile(): Promise<File> }[] = [];
  for await (const entry of directory.values()) {
    if (entry.kind === 'file' && isImage(entry.name)) entries.push(entry);
  }
  entries.sort((a, b) => a.name.localeCompare(b.name, 'fr', { numeric: true }));

  const found: { file: File; originalName: string }[] = [];
  for (const entry of entries) {
    found.push({ file: await entry.getFile(), originalName: entry.name });
  }
  loadFiles(found, directory.name);
}

async function chooseDestination(): Promise<void> {
  if (!directoryPicker) return;
  let directory: Directory;
  try {
    directory = await directoryPicker({ id: 'photos-destination', mode: 'readwrite' });
  } catch {
    return;
  }
  el.destinationRecall.hidden = true;
  void rememberFolder('destination', directory);
  useDestination(directory);
}

function useDestination(directory: Directory): void {
  destination = directory;
  el.destinationName.textContent = directory.name;
  el.chooseDestination.textContent = 'Changer de dossier de destination';
  refreshCopyButton();
}

// --- The folders of the week before ------------------------------------------

/**
 * Offered rather than restored: the browser renews access to a folder only
 * from inside a click, so the page can name last week's folder but not open it
 * on her behalf.
 */
async function offerRememberedFolders(): Promise<void> {
  if (!directoryPicker) return;

  const source = await recallFolder('source');
  if (source) {
    el.sourceRecallName.textContent = source.name;
    el.sourceRecall.hidden = false;
    el.sourceResume.addEventListener('click', () => void resumeSource(source));
  }

  const target = await recallFolder('destination');
  if (target) {
    el.destinationRecallName.textContent = target.name;
    el.destinationRecall.hidden = false;
    el.destinationResume.addEventListener('click', () => void resumeDestination(target));
  }
}

async function resumeSource(folder: Directory): Promise<void> {
  if (!(await grantAccess(folder, 'read'))) {
    await dropRemembered('source', el.sourceRecall);
    el.scanBlocked.textContent =
      'Ce dossier n’est plus accessible. Choisissez-le à nouveau ci-dessus.';
    el.scanBlocked.hidden = false;
    return;
  }
  el.sourceRecall.hidden = true;
  await readSourceDirectory(folder);
}

async function resumeDestination(folder: Directory): Promise<void> {
  if (!(await grantAccess(folder, 'readwrite'))) {
    await dropRemembered('destination', el.destinationRecall);
    return;
  }
  el.destinationRecall.hidden = true;
  useDestination(folder);
}

async function dropRemembered(slot: 'source' | 'destination', row: HTMLElement): Promise<void> {
  row.hidden = true;
  await forgetFolder(slot);
}

function loadFiles(found: { file: File; originalName: string }[], directoryName: string): void {
  files = found;
  scanDone = false;
  clearRows();
  el.resultsBlock.hidden = true;
  el.needsAttention.hidden = true;
  el.allReady.hidden = true;
  el.summary.textContent = '';
  el.sourceName.textContent = `${directoryName} — ${found.length} photo${plural(found.length)}`;
  el.chooseSource.textContent = 'Changer de dossier';
  el.scan.disabled = found.length === 0;
  el.scanStatus.textContent = '';
  el.scanBlocked.textContent =
    found.length === 0 ? 'Ce dossier ne contient aucune image. Choisissez-en un autre.' : '';
  el.scanBlocked.hidden = found.length > 0;
}

// --- Scanning ---------------------------------------------------------------

async function scanPhotos(): Promise<void> {
  el.scan.disabled = true;
  el.copy.disabled = true;
  el.copyStatus.textContent = '';
  el.scanBlocked.hidden = true;
  clearRows();
  el.resultsBlock.hidden = false;
  el.scanProgress.hidden = false;
  el.scanProgress.max = files.length;
  el.scanProgress.value = 0;
  el.scanStatus.textContent = `Lecture des photos (0/${files.length})…`;

  let recognised = 0;

  // The workers read the folder; this callback runs once per photo, in folder
  // order, so the numbering still follows the photos and not the clock.
  await readFolder(
    files.map(({ file }) => file),
    (index, photo) => {
      const entry = files[index];
      if (!entry) return;
      const firstName = firstNameFrom(photo);
      if (firstName) recognised++;

      rows.push(
        createRow(
          entry.file,
          entry.originalName,
          firstName,
          photo?.thumbnail ? URL.createObjectURL(photo.thumbnail) : '',
          photo === null ? 'error' : firstName ? 'ok' : 'missing',
        ),
      );
      el.scanProgress.value = index + 1;
      el.scanStatus.textContent = `Lecture des photos (${index + 1}/${files.length})…`;
    },
  );

  el.scanProgress.hidden = true;
  el.scan.disabled = false;
  scanDone = true;
  el.scanStatus.textContent = `${recognised} prénom${plural(recognised)} reconnu${plural(recognised)} sur ${files.length} photo${plural(files.length)}.`;
  refreshKnownNames();
  recomputeNames();
  sortCards();
  refreshCopyButton();
}

function firstNameFrom(photo: ScannedPhoto | null): string {
  return photo?.text ? extractFirstName(photo.text) : '';
}

/** Drops the gallery, releasing the thumbnails the browser is holding for us. */
function clearRows(): void {
  for (const row of rows) {
    if (row.thumbnail) URL.revokeObjectURL(row.thumbnail);
  }
  rows = [];
  el.results.textContent = '';
}

// --- Gallery ----------------------------------------------------------------

function createRow(
  file: File,
  originalName: string,
  firstName: string,
  thumbnail: string,
  status: Row['status'],
): Row {
  const card = document.createElement('article');
  card.className = 'photo-card';

  const imageArea = document.createElement('div');
  imageArea.className = 'photo-card-image';
  if (thumbnail) {
    const img = document.createElement('img');
    img.src = thumbnail;
    img.alt = '';
    img.loading = 'lazy';
    img.className = 'size-full object-contain';
    imageArea.append(img);
  } else {
    const empty = document.createElement('p');
    empty.className =
      'flex size-full flex-col items-center justify-center gap-2 px-3 text-center ' +
      'text-caption text-slate-600';
    empty.append(icon('forbidden', 'size-7 text-slate-500'), 'Aperçu impossible');
    imageArea.append(empty);
  }

  const bottom = document.createElement('div');
  bottom.className = 'flex flex-1 flex-col gap-2 border-t border-tableau p-3';

  const field = document.createElement('input');
  field.type = 'text';
  field.value = firstName;
  field.placeholder = 'Prénom';
  field.autocomplete = 'off';
  field.className = 'field w-full text-lead';
  field.setAttribute('list', 'known-names');
  field.setAttribute('aria-label', `Prénom pour ${originalName}`);

  const nameArea = document.createElement('p');
  const statusArea = document.createElement('p');

  const origin = document.createElement('p');
  origin.className = 'mt-auto pt-1 text-micro break-all text-slate-500';
  origin.textContent = originalName;

  bottom.append(field, nameArea, statusArea, origin);
  card.append(imageArea, bottom);
  el.results.append(card);

  const row: Row = {
    file,
    originalName,
    date: fileDate(file.lastModified),
    ext: extension(originalName),
    readable: isReadable(originalName),
    thumbnail,
    field,
    card,
    nameArea,
    statusArea,
    status,
    index: 1,
    targetName: '',
    copied: false,
  };

  field.addEventListener('input', () => {
    row.status = firstNameOf(row) ? 'ok' : 'missing';
    row.copied = false;
    recomputeNames();
    refreshCopyButton();
  });
  // Re-sorting waits for the end of the edit: moving the card on every letter
  // would make the photo jump under the teacher's fingers.
  field.addEventListener('change', () => {
    sortCards(row.card);
  });

  return row;
}

function recomputeNames(): void {
  const plans = planFileNames(rows.map(entryOf), chosenPattern());
  for (const [index, row] of rows.entries()) {
    const plan = plans[index];
    row.index = plan?.index ?? 1;
    row.targetName = plan?.fileName ?? '';
    renderRow(row);
  }
  refreshSummary();
}

function renderRow(row: Row): void {
  const folder =
    el.subfolders.checked && row.targetName ? `${sanitiseForFileName(firstNameOf(row))}\\` : '';

  if (row.targetName) {
    row.nameArea.className = 'font-mono text-caption break-all text-slate-700';
    row.nameArea.textContent = folder + row.targetName;
  } else {
    row.nameArea.className = 'text-caption text-amber-900';
    row.nameArea.textContent = 'Pas encore de nom de fichier';
  }

  const state = rowState(row);
  row.card.className = `photo-card ${state.card}`.trim();
  row.statusArea.className = `status-badge ${state.badge}`;
  row.statusArea.textContent = '';
  row.statusArea.append(icon(state.icon, 'size-4 shrink-0'), state.label);
}

interface RowState {
  /** Shown to the teacher, hence French. */
  label: string;
  icon: string;
  badge: string;
  card: string;
}

function rowState(row: Row): RowState {
  if (row.copied) {
    return {
      label: 'Copiée',
      icon: 'copied',
      badge: 'bg-green-100 text-green-900',
      card: 'photo-card-copied',
    };
  }
  if (!firstNameOf(row)) {
    if (!row.readable || row.status === 'error') {
      return {
        label: row.readable ? 'Photo illisible' : 'Format HEIC, non lisible',
        icon: 'forbidden',
        badge: 'bg-red-100 text-red-900',
        card: 'photo-card-error',
      };
    }
    return {
      label: 'QR non trouvé',
      icon: 'warning',
      badge: 'bg-amber-100 text-amber-900',
      card: 'photo-card-warning',
    };
  }
  if (row.status === 'error' && row.readable) {
    return {
      label: 'Copie impossible',
      icon: 'forbidden',
      badge: 'bg-red-100 text-red-900',
      card: 'photo-card-error',
    };
  }
  return {
    label: 'Prêt à copier',
    icon: 'ready',
    badge: 'bg-slate-200 text-slate-800',
    card: '',
  };
}

/**
 * Photos without a first name move to the front: they are the only ones asking
 * something of the teacher. The original order is kept inside each group, and
 * `rows` is never reordered — numbering follows the order of the photos, not
 * the order they are displayed in.
 */
function sortCards(moved?: HTMLElement): void {
  const order = [...rows.filter((row) => !firstNameOf(row)), ...rows.filter(firstNameOf)];
  if (order.every((row, index) => el.results.children[index] === row.card)) return;

  const active = document.activeElement;
  const activeField = active instanceof HTMLInputElement ? active : null;
  const caret = activeField?.selectionStart ?? null;

  for (const row of order) el.results.append(row.card);

  if (activeField?.isConnected) {
    activeField.focus();
    if (caret !== null) activeField.setSelectionRange(caret, caret);
  }

  if (moved) flash(moved);
}

/** The card is somewhere else now; the ring is how she follows it there. */
function flash(card: HTMLElement): void {
  card.classList.remove('photo-card-moved');
  card.getBoundingClientRect(); // restarts the animation on a second edit
  card.classList.add('photo-card-moved');
  card.addEventListener(
    'animationend',
    () => {
      card.classList.remove('photo-card-moved');
    },
    { once: true },
  );
}

function refreshSummary(): void {
  let ready = 0;
  let withoutName = 0;
  let unreadable = 0;
  let copied = 0;

  for (const row of rows) {
    if (row.copied) copied++;
    else if (firstNameOf(row)) ready++;
    else if (!row.readable || row.status === 'error') unreadable++;
    else withoutName++;
  }

  const parts: string[] = [];
  if (ready) parts.push(`${ready} prête${plural(ready)} à copier`);
  if (withoutName) parts.push(`${withoutName} sans prénom`);
  if (unreadable) parts.push(`${unreadable} illisible${plural(unreadable)}`);
  if (copied) parts.push(`${copied} copiée${plural(copied)}`);

  el.summary.textContent = rows.length
    ? `${rows.length} photo${plural(rows.length)} : ${parts.join(' · ')}`
    : '';

  const toFix = withoutName + unreadable;
  el.needsAttention.hidden = toFix === 0;
  el.needsAttentionText.textContent =
    toFix === 1
      ? '1 photo n’a pas encore de prénom.'
      : `${toFix} photos n’ont pas encore de prénom.`;
  el.allReady.hidden = !scanDone || toFix > 0 || rows.length === 0;

  // The remedy is on the phone, not in the app, so saying "illisible" per photo
  // leaves her with nothing to do.
  const heic = rows.filter((row) => !row.readable).length;
  el.heicNote.hidden = heic === 0;
  el.heicNote.textContent =
    heic === 0
      ? ''
      : `Dont ${heic} au format HEIC, que le navigateur ne sait pas ouvrir. Sur l’iPhone, ` +
        'réglez Appareil photo › Formats sur « Le plus compatible » pour les prochaines photos, ' +
        'et convertissez celles-ci en JPEG.';
}

function refreshCopyButton(): void {
  const pending = rows.some((row) => firstNameOf(row) && !row.copied);
  const destinationReady = !supportsDirectories || destination !== null;
  el.copy.disabled = !(scanDone && pending && destinationReady);

  const reason = el.copy.disabled ? copyBlockedReason(pending, destinationReady) : '';
  el.copyBlocked.textContent = reason;
  el.copyBlocked.hidden = reason === '';
}

/**
 * A dead button explains nothing on its own, and the teacher has no screen
 * reader to read a description to her. This block is only on screen from the
 * moment the reading starts, so it never has to word the "not scanned yet" case.
 */
function copyBlockedReason(pending: boolean, destinationReady: boolean): string {
  if (!scanDone) return 'Lecture des QR codes en cours…';
  if (!destinationReady) return 'Choisissez le dossier de destination, à l’étape 2.';
  if (!pending && rows.length > 0) {
    return rows.some(firstNameOf)
      ? 'Toutes les photos qui ont un prénom sont déjà copiées.'
      : 'Aucune photo n’a encore de prénom : une photo sans prénom n’est pas copiée.';
  }
  return '';
}

// --- Copying ----------------------------------------------------------------

async function copyPhotos(): Promise<void> {
  const todo = rows.filter((row) => firstNameOf(row) && !row.copied);
  if (todo.length === 0) return;

  el.copy.disabled = true;
  el.copyProgress.hidden = false;
  el.copyProgress.max = todo.length;
  el.copyProgress.value = 0;

  let copied = 0;
  let failed = 0;

  for (const row of todo) {
    try {
      if (destination) await copyIntoDirectory(row, destination);
      else await downloadRow(row);
      row.copied = true;
      copied++;
    } catch (error) {
      row.status = 'error';
      failed++;
      console.error(error);
    }
    renderRow(row);
    el.copyProgress.value = copied + failed;
  }

  el.copyProgress.hidden = true;
  // The app's name, said at the one moment it means something — the photos have
  // just been put away. Not when something failed: « et zou, c'est rangé » over a
  // report of losses would read as the app not having noticed.
  el.copyStatus.textContent = failed
    ? `${copied} photo${plural(copied)} copiée${plural(copied)}, ${failed} en échec.`
    : `${copied} photo${plural(copied)} copiée${plural(copied)}. Et zou, c'est rangé.`;
  refreshSummary();
  refreshCopyButton();
}

async function copyIntoDirectory(row: Row, target: Directory): Promise<void> {
  const entry = entryOf(row);
  const folder = el.subfolders.checked
    ? await target.getDirectoryHandle(entry.firstName, { create: true })
    : target;

  const { fileName, index } = await findFreeFileName(
    chosenPattern(),
    entry,
    row.index,
    (candidate) => alreadyExists(folder, candidate),
  );

  const handle = await folder.getFileHandle(fileName, { create: true });
  const stream = await handle.createWritable();
  await stream.write(row.file);
  await stream.close();

  row.index = index;
  row.targetName = fileName;
}

async function alreadyExists(folder: Directory, fileName: string): Promise<boolean> {
  try {
    await folder.getFileHandle(fileName);
    return true;
  } catch {
    return false;
  }
}

async function downloadRow(row: Row): Promise<void> {
  // No existence check is possible here, so fall back to the planned name.
  const fileName =
    row.targetName ||
    buildFileName(chosenPattern(), entryOf(row).firstName, row.date, row.index, row.ext);
  const url = URL.createObjectURL(row.file);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  // Browsers refuse downloads fired too close together.
  await new Promise((resolve) => setTimeout(resolve, 300));
  URL.revokeObjectURL(url);
}

// --- Misc -------------------------------------------------------------------

function showWarning(text: string): void {
  const box = document.createElement('div');
  box.className = 'mb-4 rounded-lg bg-blue-50 px-4 py-3';
  box.textContent = text;
  el.warning.append(box);
}
