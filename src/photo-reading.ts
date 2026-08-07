// Reading a photo: the QR code it contains, and a thumbnail for the gallery.
//
// This runs inside a worker as well as on the page (see `photo-scanning.ts`),
// so it never touches `document` unless it has to.

import { prepareZXingModule } from 'zxing-wasm/reader';
// Vite bundles the `.wasm` as a site asset. Without this import zxing would
// fetch it from a CDN: the site would stop working offline, and the children's
// photos would involve a third party.
import wasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url';
import { decodeQrCode } from './qr-decoding';

prepareZXingModule({
  // Emscripten types `locateFile` without an annotation, so we add it back.
  overrides: { locateFile: (name: string) => (name.endsWith('.wasm') ? wasmUrl : name) },
});

// Large enough for a thumbnail to stay sharp in the gallery, where the teacher
// has to recognise a child's work at a glance. Roughly 15 kB per photo: 200
// photos fit in about 3 MB.
const THUMBNAIL_SIZE = 320;

export interface ReadPhoto {
  /** Raw QR code contents, empty when no code was found. */
  text: string;
  /**
   * JPEG thumbnail. A blob rather than a data URL: it crosses the worker
   * boundary without being copied, and holding 200 of them costs a third of
   * what the base64 did. The caller owns the object URL it makes from it.
   */
  thumbnail: Blob;
}

export async function readPhoto(file: Blob): Promise<ReadPhoto> {
  // Decoding starts from the original file, not from the thumbnail: zxing needs
  // full resolution to recover a tilted label.
  const [text, thumbnail] = await Promise.all([decodeQrCode(file), makeThumbnail(file)]);
  return { text, thumbnail };
}

async function makeThumbnail(file: Blob): Promise<Blob> {
  // `from-image` applies the EXIF orientation, so a portrait photo shows the
  // right way up.
  const image = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    const scale = Math.min(1, THUMBNAIL_SIZE / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));
    return await drawToJpeg(image, width, height);
  } finally {
    image.close();
  }
}

/**
 * `OffscreenCanvas` is the only kind a worker can use, and it is also the one
 * the page prefers. The `<canvas>` branch is there for a browser too old to
 * offer it — such a browser never reaches the worker path either, so `document`
 * is available whenever we fall through to it.
 */
async function drawToJpeg(image: ImageBitmap, width: number, height: number): Promise<Blob> {
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(width, height);
    canvas.getContext('2d')?.drawImage(image, 0, 0, width, height);
    return canvas.convertToBlob({ type: 'image/jpeg', quality: 0.6 });
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d')?.drawImage(image, 0, 0, width, height);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('The browser could not encode the thumbnail'));
      },
      'image/jpeg',
      0.6,
    );
  });
}
