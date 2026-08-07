// QR code generation for the printable labels.

import qrcode from 'qrcode-generator';

// qrcode-generator 2.x encodes as latin-1 by default, which turns « Léa » into
// mojibake once decoded as UTF-8.
qrcode.stringToBytes = (text: string) => Array.from(new TextEncoder().encode(text));

/** SVG of the QR code holding `text`, ready to be inserted in the page. */
export function qrCodeSvg(text: string): string {
  // Error correction level M: the label stays readable even slightly damaged
  // or poorly lit.
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  return qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
}

/** Module matrix of the QR code — used by the tests to render a fake photo. */
export function qrCodeMatrix(text: string): boolean[][] {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const size = qr.getModuleCount();
  return Array.from({ length: size }, (_, row) =>
    Array.from({ length: size }, (_, column) => qr.isDark(row, column)),
  );
}
