// Lecture des QR codes présents sur les photos.
//
// On essaie d'abord BarcodeDetector, l'API de décodage intégrée à
// Chromium — quand elle existe, c'est le décodeur le plus tolérant. Sinon on
// retombe sur jsQR, en JavaScript pur, essayé à plusieurs échelles puis sur
// quatre zones qui se chevauchent (une étiquette de 200 px perdue dans une
// photo de 12 Mpx disparaît si l'on ne réduit qu'une seule fois).

import jsQR from 'jsqr';

const ECHELLES = [1200, 2000, 3200];
const ECHELLE_ZONE = 1600;
// Assez grand pour qu'une vignette reste nette affichée en grille, où la
// maîtresse doit reconnaître le travail de l'enfant d'un coup d'œil.
// Environ 20 ko par photo en data URL : 200 photos tiennent en ~4 Mo.
const TAILLE_VIGNETTE = 320;

interface CodeDetecte { rawValue: string }
interface Detecteur { detect(source: ImageBitmapSource): Promise<CodeDetecte[]> }
interface FabriqueDetecteur {
  new (options?: { formats?: string[] }): Detecteur;
  getSupportedFormats(): Promise<string[]>;
}

let detecteur: Detecteur | null | undefined;

/** Le décodeur natif du navigateur, ou null s'il n'est pas disponible. */
export async function detecteurNatif(): Promise<Detecteur | null> {
  if (detecteur !== undefined) return detecteur;
  detecteur = null;
  const fabrique = (globalThis as { BarcodeDetector?: FabriqueDetecteur }).BarcodeDetector;
  if (fabrique) {
    try {
      const formats = await fabrique.getSupportedFormats();
      if (formats.includes('qr_code')) detecteur = new fabrique({ formats: ['qr_code'] });
    } catch {
      // pas grave : jsQR prend le relais
    }
  }
  return detecteur;
}

export interface Zone { x: number; y: number; w: number; h: number }

export interface PhotoLue {
  /** Contenu brut du QR code, chaîne vide si aucun code n'a été trouvé. */
  texte: string;
  /** Vignette JPEG en data URL, pour l'aperçu dans le tableau. */
  vignette: string;
}

export async function lirePhoto(fichier: Blob): Promise<PhotoLue> {
  // `from-image` applique l'orientation EXIF : les photos prises en portrait
  // sont redressées avant décodage.
  const image = await createImageBitmap(fichier, { imageOrientation: 'from-image' });
  try {
    const vignette = fabriqueVignette(image);

    const natif = await detecteurNatif();
    if (natif) {
      const codes = await natif.detect(image).catch((): CodeDetecte[] => []);
      const premier = codes[0];
      if (premier?.rawValue) return { texte: premier.rawValue, vignette };
    }

    for (const taille of ECHELLES) {
      const texte = chercheAvecJsQr(image, taille);
      if (texte) return { texte, vignette };
    }

    for (const zone of quarts(image)) {
      const texte = chercheAvecJsQr(image, ECHELLE_ZONE, zone);
      if (texte) return { texte, vignette };
    }

    return { texte: '', vignette };
  } finally {
    image.close();
  }
}

let toile: HTMLCanvasElement | undefined;
let contexte: CanvasRenderingContext2D | undefined;

function pinceau(): CanvasRenderingContext2D {
  if (!contexte) {
    toile = document.createElement('canvas');
    const ctx = toile.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Canvas 2D indisponible');
    contexte = ctx;
  }
  return contexte;
}

function chercheAvecJsQr(image: ImageBitmap, taille: number, zone?: Zone): string {
  const src: Zone = zone ?? { x: 0, y: 0, w: image.width, h: image.height };
  const facteur = Math.min(1, taille / Math.max(src.w, src.h));
  const largeur = Math.max(1, Math.round(src.w * facteur));
  const hauteur = Math.max(1, Math.round(src.h * facteur));

  const ctx = pinceau();
  ctx.canvas.width = largeur;
  ctx.canvas.height = hauteur;
  ctx.drawImage(image, src.x, src.y, src.w, src.h, 0, 0, largeur, hauteur);
  const pixels = ctx.getImageData(0, 0, largeur, hauteur);

  const resultat = jsQR(pixels.data, largeur, hauteur, { inversionAttempts: 'attemptBoth' });
  return resultat?.data ?? '';
}

/** Quatre zones qui se chevauchent, couvrant chacune 60 % de la photo. */
export function quarts(taille: { width: number; height: number }): Zone[] {
  const w = Math.round(taille.width * 0.6);
  const h = Math.round(taille.height * 0.6);
  const x2 = taille.width - w;
  const y2 = taille.height - h;
  return [
    { x: 0, y: 0, w, h },
    { x: x2, y: 0, w, h },
    { x: 0, y: y2, w, h },
    { x: x2, y: y2, w, h },
  ];
}

function fabriqueVignette(image: ImageBitmap): string {
  const facteur = Math.min(1, TAILLE_VIGNETTE / Math.max(image.width, image.height));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(image.width * facteur));
  c.height = Math.max(1, Math.round(image.height * facteur));
  c.getContext('2d')?.drawImage(image, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.6);
}
