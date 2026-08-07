// Lecture d'une photo : le QR code qu'elle contient, et une vignette pour
// l'aperçu à l'écran.

import { prepareZXingModule } from 'zxing-wasm/reader';
// Le `.wasm` est empaqueté par Vite comme un asset du site. Sans cette ligne,
// zxing irait le chercher sur un CDN : le site ne fonctionnerait plus hors
// ligne, et les photos des enfants passeraient par un tiers.
import urlWasm from 'zxing-wasm/reader/zxing_reader.wasm?url';
import { decodeQrCode } from './decodage-qr';

prepareZXingModule({
  // `locateFile` est typé par Emscripten sans annotation : on la remet.
  overrides: { locateFile: (nom: string) => (nom.endsWith('.wasm') ? urlWasm : nom) },
});

// Assez grand pour qu'une vignette reste nette affichée en grille, où la
// maîtresse doit reconnaître le travail de l'enfant d'un coup d'œil.
// Environ 20 ko par photo en data URL : 200 photos tiennent en ~4 Mo.
const TAILLE_VIGNETTE = 320;

export interface PhotoLue {
  /** Contenu brut du QR code, chaîne vide si aucun code n'a été trouvé. */
  texte: string;
  /** Vignette JPEG en data URL, pour l'aperçu à l'écran. */
  vignette: string;
}

export async function lirePhoto(fichier: Blob): Promise<PhotoLue> {
  // Le décodage part du fichier d'origine, pas de la vignette : zxing a besoin
  // de la pleine résolution pour retrouver une étiquette inclinée.
  const [texte, vignette] = await Promise.all([decodeQrCode(fichier), fabriqueVignette(fichier)]);
  return { texte, vignette };
}

async function fabriqueVignette(fichier: Blob): Promise<string> {
  // `from-image` applique l'orientation EXIF : une photo prise en portrait
  // s'affiche dans le bon sens.
  const image = await createImageBitmap(fichier, { imageOrientation: 'from-image' });
  try {
    const facteur = Math.min(1, TAILLE_VIGNETTE / Math.max(image.width, image.height));
    const toile = document.createElement('canvas');
    toile.width = Math.max(1, Math.round(image.width * facteur));
    toile.height = Math.max(1, Math.round(image.height * facteur));
    toile.getContext('2d')?.drawImage(image, 0, 0, toile.width, toile.height);
    return toile.toDataURL('image/jpeg', 0.6);
  } finally {
    image.close();
  }
}
