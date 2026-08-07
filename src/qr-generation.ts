// QR code generation for the printable labels.

import qrcode from 'qrcode-generator';

// qrcode-generator 2.x encodes as latin-1 by default, which turns « Léa » into
// mojibake once decoded as UTF-8.
qrcode.stringToBytes = (text: string) => Array.from(new TextEncoder().encode(text));

// Quiet zone, in modules. The standard asks for four; the label already sits on
// a white patch, but keeping the margin inside the SVG guarantees it even when
// the paper is cut a little too close.
const QUIET_ZONE = 2;

/**
 * SVG of the QR code holding `text`, ready to be inserted in the page.
 *
 * The modules are painted with `currentColor`, so the colour comes from the CSS
 * of the label: one generated code can be printed in the child's colour or in
 * plain black without being generated again.
 */
export function qrCodeSvg(text: string): string {
  const modules = qrCodeMatrix(text);
  const size = modules.length + QUIET_ZONE * 2;

  let path = '';
  modules.forEach((row, rowIndex) => {
    row.forEach((dark, columnIndex) => {
      // One module = one 1×1 square, drawn edge to edge: rounded or spaced
      // dots look nicer on screen but cost decoding margin on a photo.
      if (dark) path += `M${columnIndex + QUIET_ZONE},${rowIndex + QUIET_ZONE}h1v1h-1z`;
    });
  });

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" ` +
    `preserveAspectRatio="xMinYMin meet" aria-hidden="true">` +
    `<path d="${path}" fill="currentColor"/></svg>`
  );
}

/** Module matrix of the QR code — used by the tests to render a fake photo. */
export function qrCodeMatrix(text: string): boolean[][] {
  // Error correction level M: the label stays readable even slightly damaged
  // or poorly lit.
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const size = qr.getModuleCount();
  return Array.from({ length: size }, (_, row) =>
    Array.from({ length: size }, (_, column) => qr.isDark(row, column)),
  );
}
