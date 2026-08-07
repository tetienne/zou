// Génération des QR codes imprimés sur les étiquettes.

import qrcode from 'qrcode-generator';

// Par défaut qrcode-generator encode en latin-1, ce qui casse « Léa ».
qrcode.stringToBytes = (s: string) => Array.from(new TextEncoder().encode(s));

/** SVG du QR code contenant `texte`, prêt à être inséré dans la page. */
export function svgQrCode(texte: string): string {
  // Correction d'erreur « M » : l'étiquette reste lisible même un peu abîmée.
  const qr = qrcode(0, 'M');
  qr.addData(texte);
  qr.make();
  return qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
}

/** Matrice de modules du QR code — utilisée par les tests. */
export function matriceQrCode(texte: string): boolean[][] {
  const qr = qrcode(0, 'M');
  qr.addData(texte);
  qr.make();
  const n = qr.getModuleCount();
  return Array.from({ length: n }, (_, r) =>
    Array.from({ length: n }, (_, c) => qr.isDark(r, c)),
  );
}
