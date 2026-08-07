// First names, image extensions and output file names.
// Deliberately DOM-free: everything here is unit-tested.

/** Image formats the browser can decode. */
export const READABLE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'avif'] as const;

/** Formats recognised as photos, including the ones we cannot decode. */
export const KNOWN_EXTENSIONS = [...READABLE_EXTENSIONS, 'heic', 'heif'] as const;

export type NamePattern = 'name_date_num' | 'name_num' | 'date_name_num';

export function extension(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot === -1 ? '' : fileName.slice(dot + 1).toLowerCase();
}

export function isImage(fileName: string): boolean {
  return (KNOWN_EXTENSIONS as readonly string[]).includes(extension(fileName));
}

export function isReadable(fileName: string): boolean {
  return (READABLE_EXTENSIONS as readonly string[]).includes(extension(fileName));
}

/**
 * The QR code normally holds the first name as plain text. We also accept
 * `prenom:Léa` or a URL like `…?prenom=Léa`, in case the labels were produced
 * by another tool. The recognised keys stay French because that is what a
 * French label generator would emit.
 */
export function extractFirstName(raw: string): string {
  let value = raw.trim();
  const parameter = /[?&](?:prenom|pr%C3%A9nom|nom|name)=([^&#]+)/i.exec(value);
  if (parameter?.[1]) {
    try {
      value = decodeURIComponent(parameter[1].replace(/\+/g, ' '));
    } catch {
      value = parameter[1];
    }
  } else {
    value = value.replace(/^(?:prenom|prénom|nom|name|eleve|élève)\s*[:=]\s*/i, '');
  }
  return value.trim();
}

const FORBIDDEN_CHARACTERS = /[<>:"/\\|?*]|[\p{Cc}\p{Cf}]/gu;

/**
 * Strips the characters Windows forbids in a file name. Accents and inner
 * hyphens are kept — they are part of the child's name.
 */
export function sanitiseForFileName(text: string): string {
  const clean = text
    .replace(FORBIDDEN_CHARACTERS, '')
    .replace(/\s+/g, '-')
    .replace(/^[.\-\s]+|[.\-\s]+$/g, '')
    .slice(0, 60);
  // Displayed in the file name, hence French.
  return clean || 'Sans-nom';
}

/** Date of the photo file, as YYYY-MM-DD. */
export function fileDate(timestamp: number): string {
  const date = new Date(timestamp);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function buildFileName(
  pattern: NamePattern,
  firstName: string,
  date: string,
  index: number,
  ext: string,
): string {
  const n = String(index).padStart(2, '0');
  const base =
    pattern === 'name_num'
      ? `${firstName}_${n}`
      : pattern === 'date_name_num'
        ? `${date}_${firstName}_${n}`
        : `${firstName}_${date}_${n}`;
  return ext ? `${base}.${ext}` : base;
}

/**
 * Counter key. Without the date in the file name, numbering has to carry over
 * from one day to the next instead of restarting at 01.
 */
export function counterKey(pattern: NamePattern, firstName: string, date: string): string {
  return pattern === 'name_num' ? firstName : `${firstName}|${date}`;
}
