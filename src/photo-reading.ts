// Reading a photo: the QR code it contains, and a thumbnail for the gallery.

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
// has to recognise a child's work at a glance. Roughly 20 kB per photo as a
// data URL: 200 photos fit in about 4 MB.
const THUMBNAIL_SIZE = 320;

export interface ReadPhoto {
  /** Raw QR code contents, empty when no code was found. */
  text: string;
  /** JPEG thumbnail as a data URL. */
  thumbnail: string;
}

export async function readPhoto(file: Blob): Promise<ReadPhoto> {
  // Decoding starts from the original file, not from the thumbnail: zxing needs
  // full resolution to recover a tilted label.
  const [text, thumbnail] = await Promise.all([decodeQrCode(file), makeThumbnail(file)]);
  return { text, thumbnail };
}

async function makeThumbnail(file: Blob): Promise<string> {
  // `from-image` applies the EXIF orientation, so a portrait photo shows the
  // right way up.
  const image = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    const scale = Math.min(1, THUMBNAIL_SIZE / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.6);
  } finally {
    image.close();
  }
}
