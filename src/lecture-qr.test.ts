// Aller-retour complet : on génère un QR code avec la même fonction que la
// page d'étiquettes, on le « photographie » (rendu en pixels, puis réduction
// comme le ferait un canvas), et on vérifie que jsQR le relit.
import { describe, expect, it } from 'vitest';
import jsQR from 'jsqr';
import { matriceQrCode, svgQrCode } from './generation-qr';
import { quarts } from './lecture-qr';

interface Pixels {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

/** Imprime le QR code dans une image blanche, à la position voulue. */
function photographie(
  texte: string,
  tailleModule: number,
  largeur: number,
  hauteur: number,
  x0: number,
  y0: number,
): Pixels {
  const matrice = matriceQrCode(texte);
  const marge = 4 * tailleModule;
  const data = new Uint8ClampedArray(largeur * hauteur * 4).fill(255);

  for (const [r, rangee] of matrice.entries()) {
    for (const [c, sombre] of rangee.entries()) {
      if (!sombre) continue;
      for (let dy = 0; dy < tailleModule; dy++) {
        for (let dx = 0; dx < tailleModule; dx++) {
          const x = x0 + marge + c * tailleModule + dx;
          const y = y0 + marge + r * tailleModule + dy;
          const p = (y * largeur + x) * 4;
          data[p] = 0;
          data[p + 1] = 0;
          data[p + 2] = 0;
        }
      }
    }
  }
  return { data, width: largeur, height: hauteur };
}

/** Réduction par moyenne de boîte, comme le fait drawImage. */
function reduire(img: Pixels, maxDim: number): Pixels {
  const facteur = Math.min(1, maxDim / Math.max(img.width, img.height));
  if (facteur === 1) return img;
  const w = Math.round(img.width * facteur);
  const h = Math.round(img.height * facteur);
  const out = new Uint8ClampedArray(w * h * 4);
  const sx = img.width / w;
  const sy = img.height / h;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let somme = 0;
      let n = 0;
      for (let j = Math.floor(y * sy); j < Math.min(img.height, Math.ceil((y + 1) * sy)); j++) {
        for (let i = Math.floor(x * sx); i < Math.min(img.width, Math.ceil((x + 1) * sx)); i++) {
          somme += img.data[(j * img.width + i) * 4] ?? 255;
          n++;
        }
      }
      const v = n ? somme / n : 255;
      const p = (y * w + x) * 4;
      out[p] = v;
      out[p + 1] = v;
      out[p + 2] = v;
      out[p + 3] = 255;
    }
  }
  return { data: out, width: w, height: h };
}

function decoupe(img: Pixels, zone: { x: number; y: number; w: number; h: number }): Pixels {
  const out = new Uint8ClampedArray(zone.w * zone.h * 4);
  for (let y = 0; y < zone.h; y++) {
    for (let x = 0; x < zone.w; x++) {
      const s = ((y + zone.y) * img.width + (x + zone.x)) * 4;
      const d = (y * zone.w + x) * 4;
      out[d] = img.data[s] ?? 255;
      out[d + 1] = img.data[s + 1] ?? 255;
      out[d + 2] = img.data[s + 2] ?? 255;
      out[d + 3] = 255;
    }
  }
  return { data: out, width: zone.w, height: zone.h };
}

function decode(img: Pixels): string | null {
  const res = jsQR(img.data, img.width, img.height, { inversionAttempts: 'attemptBoth' });
  return res?.data ?? null;
}

describe('aller-retour QR', () => {
  it.each(['Léa', 'Noé', 'Chloé B', 'Youssef', 'Marie-Claire', "Jean-Baptiste O'Neil"])(
    'encode et relit « %s » sans perdre les accents',
    (prenom) => {
      expect(decode(photographie(prenom, 8, 600, 600, 20, 20))).toBe(prenom);
    },
  );

  it('relit une étiquette perdue dans une photo de 12 Mpx, à chaque échelle', () => {
    const photo = photographie('Léa', 16, 4000, 3000, 2600, 1900);
    for (const echelle of [1200, 2000, 3200]) {
      expect(decode(reduire(photo, echelle))).toBe('Léa');
    }
  });

  it('relit une petite étiquette (~200 px) dans une photo de 12 Mpx', () => {
    const photo = photographie('Noé', 7, 4000, 3000, 3000, 2200);
    const lectures = [1200, 2000, 3200].map((e) => decode(reduire(photo, e)));
    expect(lectures).toContain('Noé');
  });

  it('rattrape une étiquette dans un coin via le découpage en zones', () => {
    const photo = photographie('Camille', 10, 4000, 3000, 3300, 2500);
    const zone = quarts(photo).find((z) => z.x > 0 && z.y > 0);
    expect(zone).toBeDefined();
    expect(decode(reduire(decoupe(photo, zone!), 1600))).toBe('Camille');
  });
});

describe('svgQrCode', () => {
  it('produit un SVG redimensionnable', () => {
    const svg = svgQrCode('Léa');
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('viewBox');
    expect(svg.trimEnd().endsWith('</svg>')).toBe(true);
  });
});
