// QR code decoding, with no DOM and no WebAssembly configuration: the caller
// decides where the `.wasm` comes from (a Vite asset in the browser, a file
// read from disk in the tests).
//
// Why zxing-wasm rather than jsQR, @zxing/library or qr-scanner: all three
// derive from the same JavaScript port of the old Java ZXing and share its
// blind spot, perspective grid extraction. Measured on photos built by 3D
// projection, all three fail from 15° of tilt, where zxing-cpp holds up to 45°
// — and runs twenty times faster, because it does not need to be retried at
// several scales.

import { readBarcodes, type ReaderOptions } from 'zxing-wasm/reader';

const OPTIONS: ReaderOptions = {
  formats: ['QRCode'],
  // tryHarder costs a few tens of milliseconds and wins the tilted cases;
  // tryRotate covers photos taken sideways; tryInvert recovers a label shot in
  // negative or with extreme contrast.
  tryHarder: true,
  tryRotate: true,
  tryInvert: true,
};

/** Raw pixel buffer, accepted outside the browser (tests). */
export interface PixelBuffer {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

/**
 * Contents of the first QR code found, or an empty string if there is none.
 * Accepts the raw photo file — zxing decodes it itself, at full resolution and
 * in a single pass.
 */
export async function decodeQrCode(input: Blob | PixelBuffer): Promise<string> {
  const results = await readBarcodes(input as Blob, OPTIONS);
  return results[0]?.text ?? '';
}
