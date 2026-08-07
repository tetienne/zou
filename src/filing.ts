// Numbering and target file name allocation.
// No DOM and no disk access: the only contact with the outside world is the
// `exists` predicate, which keeps the whole thing testable.

import { buildFileName, counterKey, type NamePattern } from './names';

export interface PhotoEntry {
  firstName: string;
  date: string;
  ext: string;
}

export interface Allocation {
  index: number;
  fileName: string;
}

/**
 * Numbers a batch of photos in order: two of Léa's works on the same day
 * become `Léa_…_01` and `Léa_…_02`. An entry without a first name is not named.
 */
export function planFileNames(
  entries: readonly PhotoEntry[],
  pattern: NamePattern,
): (Allocation | null)[] {
  const counters = new Map<string, number>();
  return entries.map((entry) => {
    if (!entry.firstName) return null;
    const key = counterKey(pattern, entry.firstName, entry.date);
    const index = (counters.get(key) ?? 0) + 1;
    counters.set(key, index);
    return {
      index,
      fileName: buildFileName(pattern, entry.firstName, entry.date, index, entry.ext),
    };
  });
}

/** Highest number allowed for one first name on one date. */
const MAX_INDEX = 999;

/**
 * Moves the number forward while a file of that name already exists, so that
 * filing the same folder twice can never overwrite anything.
 */
export async function findFreeFileName(
  pattern: NamePattern,
  entry: PhotoEntry,
  start: number,
  exists: (fileName: string) => Promise<boolean>,
): Promise<Allocation> {
  let index = start;
  let fileName = buildFileName(pattern, entry.firstName, entry.date, index, entry.ext);
  while (index < MAX_INDEX && (await exists(fileName))) {
    index++;
    fileName = buildFileName(pattern, entry.firstName, entry.date, index, entry.ext);
  }
  return { index, fileName };
}
