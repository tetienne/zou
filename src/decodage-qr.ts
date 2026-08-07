// Décodage d'un QR code, sans DOM et sans configuration du WebAssembly :
// c'est l'appelant qui décide où trouver le `.wasm` (asset Vite dans le
// navigateur, fichier lu sur le disque dans les tests).
//
// Pourquoi zxing-wasm et pas jsQR, @zxing/library ou qr-scanner : les trois
// dérivent du même portage JavaScript de l'ancien ZXing Java et partagent son
// angle mort, l'extraction de grille en perspective. Mesuré sur des photos
// fabriquées par projection 3D, les trois échouent dès 15° d'inclinaison, là
// où zxing-cpp tient jusqu'à 45° — et va vingt fois plus vite, parce qu'il
// n'a pas besoin d'être relancé à plusieurs échelles.

import { readBarcodes, type ReaderOptions } from 'zxing-wasm/reader';

const OPTIONS: ReaderOptions = {
  formats: ['QRCode'],
  // tryHarder coûte quelques dizaines de millisecondes et gagne les cas
  // inclinés ; tryRotate couvre les photos prises en travers ; tryInvert
  // rattrape une étiquette photographiée en négatif ou très contrastée.
  tryHarder: true,
  tryRotate: true,
  tryInvert: true,
};

/** Type d'image accepté en dehors du navigateur (tests). */
export interface Pixels {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

/**
 * Contenu du premier QR code trouvé, ou chaîne vide s'il n'y en a aucun.
 * Accepte le fichier photo brut — zxing le décode lui-même, en pleine
 * résolution et en une seule passe.
 */
export async function decodeQrCode(entree: Blob | Pixels): Promise<string> {
  const resultats = await readBarcodes(entree as Blob, OPTIONS);
  return resultats[0]?.text ?? '';
}
