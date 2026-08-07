// The class list, shared by the two pages through `localStorage`: typed on the
// label page, offered as autocompletion under every field on the photo page.
// The storage key lives here alone so the two pages cannot drift apart.

const STORAGE_KEY = 'qr-school.names';

/** One first name per line, exactly as the teacher typed them. */
export function loadClassList(): string {
  return localStorage.getItem(STORAGE_KEY) ?? '';
}

export function saveClassList(text: string): void {
  localStorage.setItem(STORAGE_KEY, text);
}

/** Splits the stored text into first names, ignoring blank lines. */
export function splitNames(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

/**
 * Removes repeats, keeping the first spelling met. The comparison ignores case
 * but not accents: "LÉA" and "Léa" are one child, "Lea" is left as a separate
 * suggestion because we cannot tell a missing accent from a different name.
 */
export function withoutDuplicates(firstNames: readonly string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const firstName of firstNames) {
    const key = firstName.toLocaleLowerCase('fr');
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(firstName);
  }
  return unique;
}
