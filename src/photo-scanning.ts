// Reading a whole folder of photos.
//
// The work is per-photo and CPU-bound — a 12 Mpx photo costs a few hundred
// milliseconds of WebAssembly, and a folder holds a term's worth of them — so
// it goes to one worker per core instead of blocking the page. Photos are handed
// back **in the order of the folder**, whatever order the workers finish in:
// the numbering of the output files depends on it.

import { readPhoto } from './photo-reading';
import type { ScanReply, ScanRequest } from './scan-worker';

export interface ScannedPhoto {
  /** Raw QR code contents, empty when no code was found. */
  text: string;
  /** Thumbnail, or null when the photo could not be read at all. */
  thumbnail: Blob | null;
}

/** Reads one photo and never rejects: an unreadable photo is a result. */
type Reader = (file: Blob) => Promise<ScannedPhoto | null>;

const UNREADABLE = null;

/**
 * One core is left to the page. Measured on four cores, 24 photos of 12 Mpx:
 * three workers read them in 2.9 s with a worst frame of 17 ms, four in 3.1 s
 * with a worst frame of 117 ms — taking the last core makes the scan both
 * slower and visibly jerkier. The ceiling of four is about memory rather than
 * speed: every worker holds a zxing instance and, for the length of one decode,
 * a full-resolution bitmap.
 */
function workerCount(files: number): number {
  const cores = navigator.hardwareConcurrency || 2;
  return Math.max(1, Math.min(4, cores - 1, files));
}

/**
 * Reads every photo, calling `onPhoto` once per photo in folder order. Resolves
 * when the last one has been handed over.
 */
export async function scanPhotos(
  files: readonly Blob[],
  onPhoto: (index: number, photo: ScannedPhoto | null) => void,
): Promise<void> {
  if (files.length === 0) return;

  const done = new Array<ScannedPhoto | null | undefined>(files.length);
  let handed = 0;

  // A photo is only handed over once every photo before it has been, so a slow
  // one holds back the display of its neighbours but never their reading.
  const handOverReady = (): void => {
    while (handed < files.length) {
      const photo = done[handed];
      if (photo === undefined) break;
      onPhoto(handed, photo);
      handed++;
    }
  };

  const readers = createReaders(workerCount(files.length));
  let next = 0;

  try {
    await Promise.all(
      readers.map(async ({ read }) => {
        while (next < files.length) {
          const index = next++;
          const file = files[index];
          if (!file) break;
          done[index] = await read(file);
          handOverReady();
        }
      }),
    );
  } finally {
    for (const reader of readers) reader.stop();
  }
}

interface PooledReader {
  read: Reader;
  stop: () => void;
}

function createReaders(count: number): PooledReader[] {
  if (typeof Worker === 'undefined') return [mainThreadReader()];
  try {
    return Array.from({ length: count }, () => workerReader());
  } catch {
    // A browser that refuses module workers still gets a working page, just a
    // slower one.
    return [mainThreadReader()];
  }
}

function mainThreadReader(): PooledReader {
  return {
    read: (file) =>
      readPhoto(file).then(
        ({ text, thumbnail }) => ({ text, thumbnail }),
        () => UNREADABLE,
      ),
    stop: () => undefined,
  };
}

function workerReader(): PooledReader {
  const worker = new Worker(new URL('./scan-worker.ts', import.meta.url), { type: 'module' });

  const read: Reader = (file) =>
    new Promise((resolve) => {
      const finish = (photo: ScannedPhoto | null): void => {
        worker.removeEventListener('message', onMessage);
        worker.removeEventListener('error', onError);
        resolve(photo);
      };
      const onMessage = (event: MessageEvent<ScanReply>): void => {
        const reply = event.data;
        finish(reply.ok ? { text: reply.text, thumbnail: reply.thumbnail } : UNREADABLE);
      };
      // A worker that dies takes only its own photo down with it; the loop
      // hands it the next one.
      const onError = (): void => {
        finish(UNREADABLE);
      };

      worker.addEventListener('message', onMessage);
      worker.addEventListener('error', onError);
      worker.postMessage({ file } satisfies ScanRequest);
    });

  return {
    read,
    stop: () => {
      worker.terminate();
    },
  };
}
