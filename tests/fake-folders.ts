// The photo page talks to the disk through `showDirectoryPicker`, which no test
// can drive: the picker is a native window. So the tests hand the page a pair of
// fake folders instead — a source that yields photos we drew ourselves, and a
// destination that records what was written to it.
//
// The photos are drawn in the browser from the QR matrix the label page uses, so
// nothing binary is committed and a label always matches what the app produces.
// Realism is not the point here and is not attempted: `photo-reading.test.ts`
// owns the decoder's tolerance to tilt and colour, with photos built by 3D
// projection. These tests own the plumbing around it.

import type { Page } from '@playwright/test';
import { qrCodeMatrix } from '../src/qr-generation';

export interface PhotoSpec {
  /** File name in the source folder; the page sorts on it. */
  name: string;
  /** First name to put in the QR code, or null for a photo carrying none. */
  firstName: string | null;
  /**
   * Pixels per QR module. A large photo takes visibly longer to decode, which
   * is how the tests make the workers finish out of order on purpose.
   */
  cell?: number;
  /** Bytes that decode to nothing, for the HEIC case. */
  garbage?: boolean;
}

interface WireSpec {
  name: string;
  modules: boolean[][] | null;
  cell: number;
  garbage: boolean;
}

/** Files the destination folder received, as `path` → byte length. */
export type Written = Record<string, number>;

/**
 * Installs the fake picker before the page loads. `existing` pre-fills the
 * destination so a run can collide with a previous one.
 */
export async function useFakeFolders(
  page: Page,
  photos: readonly PhotoSpec[],
  existing: readonly string[] = [],
): Promise<void> {
  const wire: WireSpec[] = photos.map((photo) => ({
    name: photo.name,
    modules: photo.firstName === null ? null : qrCodeMatrix(photo.firstName),
    cell: photo.cell ?? 4,
    garbage: photo.garbage ?? false,
  }));

  await page.addInitScript(
    ({ specs, alreadyThere }: { specs: WireSpec[]; alreadyThere: readonly string[] }) => {
      const written: Written = {};
      (window as unknown as { __written: Written }).__written = written;

      const QUIET_ZONE = 4;

      function paint(spec: WireSpec): HTMLCanvasElement {
        const canvas = document.createElement('canvas');
        if (spec.modules === null) {
          // A photo of something that is not a label at all.
          canvas.width = 400;
          canvas.height = 300;
          const flat = canvas.getContext('2d');
          if (flat) {
            flat.fillStyle = '#dcdcdc';
            flat.fillRect(0, 0, 400, 300);
            flat.fillStyle = '#b03030';
            flat.beginPath();
            flat.arc(200, 150, 80, 0, Math.PI * 2);
            flat.fill();
          }
          return canvas;
        }

        const modules = spec.modules;
        const side = (modules.length + QUIET_ZONE * 2) * spec.cell;
        canvas.width = side;
        canvas.height = side;
        const paper = canvas.getContext('2d');
        if (!paper) return canvas;
        paper.fillStyle = '#ffffff';
        paper.fillRect(0, 0, side, side);
        paper.fillStyle = '#111827';
        modules.forEach((row, y) => {
          row.forEach((dark, x) => {
            if (!dark) return;
            paper.fillRect(
              (x + QUIET_ZONE) * spec.cell,
              (y + QUIET_ZONE) * spec.cell,
              spec.cell,
              spec.cell,
            );
          });
        });
        return canvas;
      }

      async function fileOf(spec: WireSpec): Promise<File> {
        if (spec.garbage) {
          const bytes = new Uint8Array(2048).map((_, i) => (i * 37) % 251);
          return new File([bytes], spec.name, { type: 'image/heic' });
        }
        const canvas = paint(spec);
        const blob = await new Promise<Blob | null>((resolve) => {
          canvas.toBlob(resolve, 'image/png');
        });
        return new File([blob ?? new Blob()], spec.name, { type: 'image/png' });
      }

      const source = {
        name: 'Photos de la classe',
        // A plain generator is enough: `for await` walks a sync iterable too.
        values() {
          return (function* entries() {
            for (const spec of specs) {
              yield { kind: 'file', name: spec.name, getFile: () => fileOf(spec) };
            }
          })();
        },
      };

      function folder(path: string, present: Set<string>) {
        const children = new Map<string, ReturnType<typeof folder>>();
        return {
          name: path,
          getDirectoryHandle(child: string) {
            const key = path ? `${path}/${child}` : child;
            if (!children.has(child)) children.set(child, folder(key, present));
            return Promise.resolve(children.get(child));
          },
          getFileHandle(name: string, options?: { create?: boolean }) {
            const full = path ? `${path}/${name}` : name;
            if (!options?.create) {
              // Rejecting is how the page learns a name is still free.
              return present.has(full)
                ? Promise.resolve({})
                : Promise.reject(new Error('not found'));
            }
            present.add(full);
            return Promise.resolve({
              createWritable: () =>
                Promise.resolve({
                  write: (blob: Blob) => {
                    written[full] = blob.size;
                    return Promise.resolve();
                  },
                  close: () => Promise.resolve(),
                }),
            });
          },
        };
      }

      const destination = folder('', new Set(alreadyThere));

      (window as unknown as { showDirectoryPicker: unknown }).showDirectoryPicker = (options?: {
        id?: string;
      }) => Promise.resolve(options?.id === 'photos-destination' ? destination : source);
    },
    { specs: wire, alreadyThere: existing },
  );
}

/** What the destination folder ended up holding. */
export function writtenFiles(page: Page): Promise<Written> {
  return page.evaluate(() => (window as unknown as { __written: Written }).__written);
}
