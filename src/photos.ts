// "Ranger les photos" page: read the QR codes of a folder, check them in a
// gallery, then copy the photos out under their new names.
//
// Alpine drives the page: `photosPage` below holds the whole state, and
// `photos.html` binds to it. Everything on screen is derived from that state
// through getters, so there is no "refresh the screen" step left to forget.
// Alpine expressions sit outside the reach of `tsc`, so the getters hand the
// template values it only has to display: the logic stays in TypeScript, and
// the markup stays a list of plain property reads.

import './style.css';
import Alpine from 'alpinejs';
import { readPhoto } from './photo-reading';
import { loadClassList, splitNames, withoutDuplicates } from './class-list';
import {
  extension,
  extractFirstName,
  fileDate,
  isImage,
  isReadable,
  sanitiseForFileName,
  type NamePattern,
} from './names';
import { findFreeFileName, planFileNames, type Allocation, type PhotoEntry } from './filing';

// --- File System Access API -------------------------------------------------
// Not typed by lib.dom, so we describe only what we use.

interface PickerOptions {
  id?: string;
  mode?: 'read' | 'readwrite';
}
type DirectoryPicker = (options?: PickerOptions) => Promise<Directory>;

interface Directory {
  readonly name: string;
  values(): AsyncIterable<{ kind: string; name: string; getFile(): Promise<File> }>;
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<Directory>;
  getFileHandle(
    name: string,
    options?: { create?: boolean },
  ): Promise<{
    createWritable(): Promise<{ write(data: Blob): Promise<void>; close(): Promise<void> }>;
  }>;
}

const directoryPicker = (window as unknown as { showDirectoryPicker?: DirectoryPicker })
  .showDirectoryPicker;
const supportsDirectories = typeof directoryPicker === 'function';

// --- Thumbnail size (remembered from one week to the next) -------------------

const SIZE_STORAGE_KEY = 'qr-school.size';
const SIZES = ['small', 'medium', 'large'] as const;
type Size = (typeof SIZES)[number];

const SIZE_CLASSES: Record<Size, string> = {
  small: 'gallery-small',
  medium: 'gallery-medium',
  large: 'gallery-large',
};

function storedSize(): Size {
  const stored = localStorage.getItem(SIZE_STORAGE_KEY) ?? '';
  return (SIZES as readonly string[]).includes(stored) ? (stored as Size) : 'medium';
}

// --- Small icons (never colour alone) ---------------------------------------
// Inline SVG paths, dropped into a `<svg>` by `x-html`. They are constants of
// this file, never anything the teacher typed.

const ICONS = {
  ready: '<path d="m20 6-11 11-5-5"/>',
  warning:
    '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>' +
    '<path d="M12 9v4"/><path d="M12 17h.01"/>',
  forbidden: '<circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/>',
  copied: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
} as const;

// --- State ------------------------------------------------------------------

type Status = 'ok' | 'missing' | 'error';

interface Row {
  /** Identity of the card in the gallery, so Alpine reuses its DOM on re-sort. */
  readonly id: number;
  readonly file: File;
  readonly originalName: string;
  readonly date: string;
  readonly ext: string;
  /** False for HEIC/HEIF: the browser cannot display them. */
  readonly readable: boolean;
  /** Data URL, empty when the photo could not be decoded. */
  readonly thumbnail: string;
  firstName: string;
  status: Status;
  /**
   * 0 while the photo has no first name, 1 once it has one. The gallery sorts
   * on it, so photos still asking something of the teacher stay at the front.
   * Only refreshed once the edit is committed: re-sorting on every letter would
   * make the photo jump under her fingers.
   */
  rank: number;
  /** Name the photo was really written under, empty until it is copied. */
  writtenName: string;
  copied: boolean;
}

const firstNameOf = (row: Row): string => row.firstName.trim();

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

interface RowState {
  /** Shown to the teacher, hence French. */
  label: string;
  /** SVG paths, always paired with the label — never colour alone. */
  icon: string;
  badgeClass: string;
  cardClass: string;
}

function rowState(row: Row): RowState {
  if (row.copied) {
    return {
      label: 'Copiée',
      icon: ICONS.copied,
      badgeClass: 'bg-green-100 text-green-900',
      cardClass: 'photo-card-copied',
    };
  }
  if (!firstNameOf(row)) {
    if (!row.readable || row.status === 'error') {
      return {
        label: row.readable ? 'Photo illisible' : 'Format HEIC, non lisible',
        icon: ICONS.forbidden,
        badgeClass: 'bg-red-100 text-red-900',
        cardClass: 'photo-card-error',
      };
    }
    return {
      label: 'QR non trouvé',
      icon: ICONS.warning,
      badgeClass: 'bg-amber-100 text-amber-900',
      cardClass: 'photo-card-warning',
    };
  }
  if (row.status === 'error' && row.readable) {
    return {
      label: 'Copie impossible',
      icon: ICONS.forbidden,
      badgeClass: 'bg-red-100 text-red-900',
      cardClass: 'photo-card-error',
    };
  }
  return {
    label: 'Prêt à copier',
    icon: ICONS.ready,
    badgeClass: 'bg-slate-200 text-slate-800',
    cardClass: '',
  };
}

/** One gallery card, ready to display: the template does no work of its own. */
interface Card {
  row: Row;
  state: RowState;
  nameLabel: string;
  nameClass: string;
}

interface Counts {
  ready: number;
  withoutName: number;
  unreadable: number;
  copied: number;
  /** Photos the teacher still has to deal with. */
  toFix: number;
}

const plural = (n: number): string => (n > 1 ? 's' : '');

// --- The page ---------------------------------------------------------------

let nextId = 0;

function photosPage() {
  return {
    // --- Preferences -------------------------------------------------------
    size: storedSize(),
    pattern: 'name_date_num' as NamePattern,
    // Without folder access there is nowhere to create a subfolder.
    subfolders: supportsDirectories,
    supportsDirectories,

    // --- Folders -----------------------------------------------------------
    loaded: [] as { file: File; originalName: string }[],
    sourceLabel: 'aucun dossier choisi',
    destination: null as Directory | null,
    destinationLabel: supportsDirectories ? 'aucun dossier choisi' : 'dossier « Téléchargements »',

    // --- Scanning ----------------------------------------------------------
    rows: [] as Row[],
    scanning: false,
    scanned: 0,
    scanStatus: '',
    scanDone: false,

    // --- Copying -----------------------------------------------------------
    copying: false,
    copyDone: 0,
    copyTotal: 0,
    copyStatus: '',

    init(): void {
      // `Alpine.effect` rather than the `$watch` magic: the magics only exist
      // inside Alpine expressions, where `tsc` cannot follow, while the methods
      // on the imported `Alpine` are typed. The first run rewrites the value we
      // have just read, which costs nothing.
      Alpine.effect(() => {
        localStorage.setItem(SIZE_STORAGE_KEY, this.size);
      });
    },

    // --- Derived: everything the markup displays ---------------------------

    get warning(): string {
      if (supportsDirectories) return '';
      return (
        'Ce navigateur ne sait pas écrire directement dans un dossier. Les photos renommées ' +
        'arriveront une par une dans votre dossier « Téléchargements ». Pour un rangement ' +
        'automatique, utilisez Microsoft Edge ou Google Chrome.'
      );
    },

    /**
     * Only the size class: `x-bind:class` adds to the static `class`, it does
     * not replace it, so leaving `gallery-medium` in the markup would keep it
     * alongside the chosen one and let the later of the two rules win.
     */
    get galleryClass(): string {
      return SIZE_CLASSES[this.size];
    },

    get copyLabel(): string {
      return supportsDirectories ? 'Copier les photos' : 'Télécharger les photos renommées';
    },

    /** The class list first, then the first names the photos yielded. */
    get knownNames(): string[] {
      return withoutDuplicates([
        ...splitNames(loadClassList()),
        ...this.rows.map(firstNameOf).filter(Boolean),
      ]);
    },

    /**
     * Numbering follows the order of the photos, not the order they are shown
     * in: `rows` is never reordered, only the cards are.
     */
    get cards(): Card[] {
      const plans = planFileNames(this.rows.map(entryOf), this.pattern);
      return this.rows
        .map((row, index) => {
          const planned = plans[index]?.fileName ?? '';
          const name = row.writtenName || planned;
          const folder =
            this.subfolders && name ? `${sanitiseForFileName(firstNameOf(row))}\\` : '';
          return {
            row,
            state: rowState(row),
            nameLabel: name ? folder + name : 'Pas encore de nom de fichier',
            nameClass: name
              ? 'font-mono text-[0.85rem] break-all text-slate-700'
              : 'text-[0.85rem] text-amber-900',
          };
        })
        .sort((a, b) => a.row.rank - b.row.rank);
    },

    get counts(): Counts {
      let ready = 0;
      let withoutName = 0;
      let unreadable = 0;
      let copied = 0;

      for (const row of this.rows) {
        if (row.copied) copied++;
        else if (firstNameOf(row)) ready++;
        else if (!row.readable || row.status === 'error') unreadable++;
        else withoutName++;
      }

      return { ready, withoutName, unreadable, copied, toFix: withoutName + unreadable };
    },

    get summary(): string {
      const { ready, withoutName, unreadable, copied } = this.counts;
      const parts: string[] = [];
      if (ready) parts.push(`${ready} prête${plural(ready)} à copier`);
      if (withoutName) parts.push(`${withoutName} sans prénom`);
      if (unreadable) parts.push(`${unreadable} illisible${plural(unreadable)}`);
      if (copied) parts.push(`${copied} copiée${plural(copied)}`);

      const total = this.rows.length;
      return total ? `${total} photo${plural(total)} : ${parts.join(' · ')}` : '';
    },

    get needsAttentionText(): string {
      const { toFix } = this.counts;
      return toFix === 1
        ? '1 photo n’a pas encore de prénom.'
        : `${toFix} photos n’ont pas encore de prénom.`;
    },

    get allReady(): boolean {
      return this.scanDone && this.counts.toFix === 0 && this.rows.length > 0;
    },

    get canScan(): boolean {
      return !this.scanning && this.loaded.length > 0;
    },

    get canCopy(): boolean {
      const pending = this.rows.some((row) => firstNameOf(row) && !row.copied);
      const destinationReady = !supportsDirectories || this.destination !== null;
      return this.scanDone && !this.copying && pending && destinationReady;
    },

    // --- Folder selection --------------------------------------------------

    async chooseSource(fallback: HTMLInputElement): Promise<void> {
      if (!directoryPicker) {
        fallback.click();
        return;
      }

      let directory: Directory;
      try {
        directory = await directoryPicker({ id: 'photos-source', mode: 'read' });
      } catch {
        return; // cancelled
      }

      const entries: { name: string; getFile(): Promise<File> }[] = [];
      for await (const entry of directory.values()) {
        if (entry.kind === 'file' && isImage(entry.name)) entries.push(entry);
      }
      entries.sort((a, b) => a.name.localeCompare(b.name, 'fr', { numeric: true }));

      const found: { file: File; originalName: string }[] = [];
      for (const entry of entries) {
        found.push({ file: await entry.getFile(), originalName: entry.name });
      }
      this.load(found, directory.name);
    },

    async chooseDestination(): Promise<void> {
      if (!directoryPicker) return;
      try {
        this.destination = await directoryPicker({ id: 'photos-destination', mode: 'readwrite' });
      } catch {
        return; // cancelled
      }
      this.destinationLabel = this.destination.name;
    },

    /** Browsers without folder access hand us the files through an `<input>`. */
    onFallbackFiles(event: Event): void {
      const input = event.target as HTMLInputElement;
      const chosen = [...(input.files ?? [])].filter((file) => isImage(file.name));
      this.load(
        chosen.map((file) => ({ file, originalName: file.name })),
        'dossier choisi',
      );
    },

    load(found: { file: File; originalName: string }[], directoryName: string): void {
      this.loaded = found;
      this.rows = [];
      this.scanDone = false;
      this.copyStatus = '';
      this.sourceLabel = `${directoryName} — ${found.length} photo(s)`;
      this.scanStatus = found.length === 0 ? 'Aucune image trouvée dans ce dossier.' : '';
    },

    // --- Scanning ----------------------------------------------------------

    async scan(): Promise<void> {
      this.scanning = true;
      this.scanned = 0;
      this.scanDone = false;
      this.rows = [];
      this.copyStatus = '';

      let recognised = 0;
      for (const [index, { file, originalName }] of this.loaded.entries()) {
        this.scanStatus = `Lecture de ${originalName} (${index + 1}/${this.loaded.length})…`;

        let firstName = '';
        let thumbnail = '';
        let status: Status = 'missing';

        if (!isReadable(originalName)) {
          status = 'error';
        } else {
          try {
            const read = await readPhoto(file);
            thumbnail = read.thumbnail;
            firstName = read.text ? extractFirstName(read.text) : '';
            if (firstName) {
              status = 'ok';
              recognised++;
            }
          } catch {
            status = 'error';
          }
        }

        this.rows.push({
          id: nextId++,
          file,
          originalName,
          date: fileDate(file.lastModified),
          ext: extension(originalName),
          readable: isReadable(originalName),
          thumbnail,
          firstName,
          status,
          rank: firstName ? 1 : 0,
          writtenName: '',
          copied: false,
        });
        this.scanned = index + 1;
      }

      this.scanning = false;
      this.scanDone = true;
      this.scanStatus = `${recognised} prénom(s) reconnu(s) sur ${this.loaded.length} photo(s).`;
    },

    // --- Editing a first name ----------------------------------------------

    edit(row: Row, event: Event): void {
      const typed = (event.target as HTMLInputElement).value;
      row.firstName = typed;
      row.status = typed.trim() ? 'ok' : 'missing';
      row.copied = false;
      row.writtenName = '';
    },

    /**
     * Called once the edit is committed, never on every letter. Moving the card
     * drops the focus, so we put it back: `change` also fires on Enter, with the
     * teacher still in the field.
     */
    commit(row: Row, field: HTMLInputElement): void {
      const rank = firstNameOf(row) ? 1 : 0;
      if (rank === row.rank) return;

      const focused = document.activeElement === field;
      const caret = field.selectionStart;
      row.rank = rank;
      if (!focused) return;

      void Alpine.nextTick(() => {
        field.focus();
        if (caret !== null) field.setSelectionRange(caret, caret);
      });
    },

    // --- Copying -----------------------------------------------------------

    async copy(): Promise<void> {
      const plans = planFileNames(this.rows.map(entryOf), this.pattern);
      const todo = this.rows
        .map((row, index) => ({ row, plan: plans[index] ?? null }))
        .filter((item): item is { row: Row; plan: Allocation } => item.plan !== null)
        .filter((item) => !item.row.copied);
      if (todo.length === 0) return;

      this.copying = true;
      this.copyDone = 0;
      this.copyTotal = todo.length;

      let copied = 0;
      let failed = 0;

      for (const { row, plan } of todo) {
        try {
          if (this.destination) await copyIntoDirectory(row, plan, this);
          else await downloadRow(row, plan);
          row.copied = true;
          copied++;
        } catch (error) {
          row.status = 'error';
          failed++;
          console.error(error);
        }
        this.copyDone = copied + failed;
      }

      this.copying = false;
      this.copyStatus = failed
        ? `${copied} photo(s) copiée(s), ${failed} en échec.`
        : `${copied} photo(s) copiée(s).`;
    },
  };
}

/** What `copyIntoDirectory` needs from the page, so it stays a plain function. */
interface CopySettings {
  destination: Directory | null;
  subfolders: boolean;
  pattern: NamePattern;
}

async function copyIntoDirectory(
  row: Row,
  plan: Allocation,
  settings: CopySettings,
): Promise<void> {
  const target = settings.destination;
  if (!target) return;

  const entry = entryOf(row);
  const folder = settings.subfolders
    ? await target.getDirectoryHandle(entry.firstName, { create: true })
    : target;

  const { fileName } = await findFreeFileName(settings.pattern, entry, plan.index, (candidate) =>
    alreadyExists(folder, candidate),
  );

  const handle = await folder.getFileHandle(fileName, { create: true });
  const stream = await handle.createWritable();
  await stream.write(row.file);
  await stream.close();

  row.writtenName = fileName;
}

async function alreadyExists(folder: Directory, fileName: string): Promise<boolean> {
  try {
    await folder.getFileHandle(fileName);
    return true;
  } catch {
    return false;
  }
}

async function downloadRow(row: Row, plan: Allocation): Promise<void> {
  // No existence check is possible here, so we keep the planned name.
  const url = URL.createObjectURL(row.file);
  const link = document.createElement('a');
  link.href = url;
  link.download = plan.fileName;
  document.body.append(link);
  link.click();
  link.remove();
  // Browsers refuse downloads fired too close together.
  await new Promise((resolve) => setTimeout(resolve, 300));
  URL.revokeObjectURL(url);
  row.writtenName = plan.fileName;
}

Alpine.data('photosPage', photosPage);
Alpine.start();
