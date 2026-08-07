// Robustesse du décodage, sans navigateur.
//
// Le QR code est généré par la fonction que la page d'étiquettes utilise
// réellement, puis « photographié » : projection 3D de l'étiquette inclinée,
// homographie inverse et échantillonnage bilinéaire. C'est ce qui distingue
// une photo prise de biais d'une simple image tournée — et c'est exactement
// le cas que les décodeurs en JavaScript pur ne savent pas traiter.
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { prepareZXingModule } from 'zxing-wasm/reader';
import { decodeQrCode, type Pixels } from './decodage-qr';
import { matriceQrCode, svgQrCode } from './generation-qr';

const PRENOM = 'Léa';

beforeAll(async () => {
  // En Node il n'y a rien à télécharger : on donne le binaire directement.
  const wasmBinary = readFileSync(
    new URL('../node_modules/zxing-wasm/dist/reader/zxing_reader.wasm', import.meta.url),
  );
  await prepareZXingModule({ overrides: { wasmBinary }, fireImmediately: true });
});

// --- Fabrique de photos ----------------------------------------------------

interface Degradations {
  /** Côté de l'étiquette en pixels, avant projection. */
  taille?: number;
  /** Inclinaison de l'étiquette par rapport au plan de l'objectif. */
  inclinaisonX?: number;
  inclinaisonY?: number;
  /** Rotation dans le plan de l'image. */
  rotation?: number;
  largeur?: number;
  hauteur?: number;
}

type Coin = readonly [number, number];

/** Étiquette nette : QR noir sur fond blanc, avec la marge de 4 modules. */
function etiquette(taille: number): Pixels {
  const matrice = matriceQrCode(PRENOM);
  const modules = matrice.length;
  const cote = Math.max(2, Math.floor(taille / (modules + 8)));
  const marge = 4 * cote;
  const largeur = modules * cote + marge * 2;

  const data = new Uint8ClampedArray(largeur * largeur * 4).fill(255);
  for (const [r, rangee] of matrice.entries()) {
    for (const [c, sombre] of rangee.entries()) {
      if (!sombre) continue;
      for (let dy = 0; dy < cote; dy++) {
        for (let dx = 0; dx < cote; dx++) {
          const p = ((marge + r * cote + dy) * largeur + marge + c * cote + dx) * 4;
          data[p] = 0;
          data[p + 1] = 0;
          data[p + 2] = 0;
        }
      }
    }
  }
  return { data, width: largeur, height: largeur };
}

/** Coins de l'étiquette après rotation 3D puis projection perspective. */
function quadrilatere(taille: number, degX: number, degY: number, rotation: number): Coin[] {
  const a = (degX * Math.PI) / 180;
  const b = (degY * Math.PI) / 180;
  const focale = 2.2;
  const distance = taille * focale;
  const demi = taille / 2;
  const rot = (rotation * Math.PI) / 180;

  const coins: Coin[] = [
    [-demi, -demi],
    [demi, -demi],
    [demi, demi],
    [-demi, demi],
  ];

  return coins.map(([x, y]): Coin => {
    const yX = y * Math.cos(a);
    const zX = y * Math.sin(a);
    const xY = x * Math.cos(b) + zX * Math.sin(b);
    const zY = -x * Math.sin(b) + zX * Math.cos(b);
    const k = (focale * taille) / (distance + zY);
    const px = xY * k;
    const py = yX * k;
    return [px * Math.cos(rot) - py * Math.sin(rot), px * Math.sin(rot) + py * Math.cos(rot)];
  });
}

/** Homographie carré unité → quadrilatère (Heckbert), renvoyée inversée. */
function homographieInverse(quad: Coin[]): number[][] {
  const [c0, c1, c2, c3] = quad as [Coin, Coin, Coin, Coin];
  const [x0, y0] = c0;
  const [x1, y1] = c1;
  const [x2, y2] = c2;
  const [x3, y3] = c3;

  const dx1 = x1 - x2;
  const dy1 = y1 - y2;
  const dx2 = x3 - x2;
  const dy2 = y3 - y2;
  const den = dx1 * dy2 - dx2 * dy1;
  const g = ((x0 - x1 + x2 - x3) * dy2 - dx2 * (y0 - y1 + y2 - y3)) / den;
  const h = (dx1 * (y0 - y1 + y2 - y3) - (x0 - x1 + x2 - x3) * dy1) / den;

  const a = x1 - x0 + g * x1;
  const b = x3 - x0 + h * x3;
  const c = x0;
  const d = y1 - y0 + g * y1;
  const e = y3 - y0 + h * y3;
  const f = y0;

  const det = a * (e - f * h) - b * (d - f * g) + c * (d * h - e * g);
  return [
    [(e - f * h) / det, (c * h - b) / det, (b * f - c * e) / det],
    [(f * g - d) / det, (a - c * g) / det, (c * d - a * f) / det],
    [(d * h - e * g) / det, (b * g - a * h) / det, (a * e - b * d) / det],
  ];
}

/** Colle l'étiquette dans une photo, en la projetant. */
function photographie(deg: Degradations = {}): Pixels {
  const { taille = 500, inclinaisonX = 0, inclinaisonY = 0, rotation = 0 } = deg;
  const largeur = deg.largeur ?? 3000;
  const hauteur = deg.hauteur ?? 2000;

  const label = etiquette(taille);
  const cx = Math.round(largeur * 0.72);
  const cy = Math.round(hauteur * 0.66);
  const quad = quadrilatere(taille, inclinaisonX, inclinaisonY, rotation).map(([x, y]): Coin => [
    x + cx,
    y + cy,
  ]);
  const inv = homographieInverse(quad);

  // Fond uni : la table sur laquelle le travail est posé.
  const data = new Uint8ClampedArray(largeur * hauteur * 4).fill(255);
  for (let i = 0; i < largeur * hauteur; i++) {
    data[i * 4] = 200;
    data[i * 4 + 1] = 184;
    data[i * 4 + 2] = 154;
  }

  const xs = quad.map(([x]) => x);
  const ys = quad.map(([, y]) => y);
  const x0 = Math.max(0, Math.floor(Math.min(...xs)));
  const x1 = Math.min(largeur, Math.ceil(Math.max(...xs)));
  const y0 = Math.max(0, Math.floor(Math.min(...ys)));
  const y1 = Math.min(hauteur, Math.ceil(Math.max(...ys)));

  const SS = 2; // 2×2 échantillons par pixel, pour limiter l'escalier
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      let somme = 0;
      let n = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px = x + (sx + 0.5) / SS;
          const py = y + (sy + 0.5) / SS;
          const w = inv[2]![0]! * px + inv[2]![1]! * py + inv[2]![2]!;
          const u = (inv[0]![0]! * px + inv[0]![1]! * py + inv[0]![2]!) / w;
          const v = (inv[1]![0]! * px + inv[1]![1]! * py + inv[1]![2]!) / w;
          if (u < 0 || u >= 1 || v < 0 || v >= 1) continue;
          somme += echantillon(label, u, v);
          n++;
        }
      }
      if (n === 0) continue;
      const couverture = n / (SS * SS);
      const valeur = somme / n;
      const p = (y * largeur + x) * 4;
      for (let k = 0; k < 3; k++) {
        data[p + k] = data[p + k]! * (1 - couverture) + valeur * couverture;
      }
    }
  }
  return { data, width: largeur, height: hauteur };
}

/** Échantillonnage bilinéaire du canal rouge (l'étiquette est en gris). */
function echantillon(img: Pixels, u: number, v: number): number {
  const fx = u * (img.width - 1);
  const fy = v * (img.height - 1);
  const ix = Math.floor(fx);
  const iy = Math.floor(fy);
  const tx = fx - ix;
  const ty = fy - iy;
  const ix2 = Math.min(img.width - 1, ix + 1);
  const iy2 = Math.min(img.height - 1, iy + 1);
  const p = (y: number, x: number) => img.data[(y * img.width + x) * 4] ?? 255;
  return (
    p(iy, ix) * (1 - tx) * (1 - ty) +
    p(iy, ix2) * tx * (1 - ty) +
    p(iy2, ix) * (1 - tx) * ty +
    p(iy2, ix2) * tx * ty
  );
}

// --- Tests -----------------------------------------------------------------

describe('aller-retour QR', () => {
  it.each(['Léa', 'Noé', 'Chloé B', 'Youssef', 'Marie-Claire', "Jean-Baptiste O'Neil"])(
    'encode et relit « %s » sans perdre les accents',
    async (prenom) => {
      const matrice = matriceQrCode(prenom);
      expect(matrice.length).toBeGreaterThan(0);
      // On ne peut pas réutiliser photographie() ici (elle fixe le prénom),
      // donc on décode l'étiquette rendue à l'identique.
      const cote = 8;
      const marge = 4 * cote;
      const n = matrice.length;
      const largeur = n * cote + marge * 2;
      const data = new Uint8ClampedArray(largeur * largeur * 4).fill(255);
      for (const [r, rangee] of matrice.entries()) {
        for (const [c, sombre] of rangee.entries()) {
          if (!sombre) continue;
          for (let dy = 0; dy < cote; dy++) {
            for (let dx = 0; dx < cote; dx++) {
              const p = ((marge + r * cote + dy) * largeur + marge + c * cote + dx) * 4;
              data[p] = 0;
              data[p + 1] = 0;
              data[p + 2] = 0;
            }
          }
        }
      }
      await expect(decodeQrCode({ data, width: largeur, height: largeur })).resolves.toBe(prenom);
    },
  );
});

describe('photo prise de biais', () => {
  // Une photo à main levée est presque toujours un peu inclinée : c'est le cas
  // normal, pas le cas limite.
  it.each([0, 15, 25, 35, 45])('décode une inclinaison de %i° sur un axe', async (degres) => {
    await expect(decodeQrCode(photographie({ inclinaisonX: degres }))).resolves.toBe(PRENOM);
  });

  it.each([15, 25, 35])('décode une inclinaison de %i° sur deux axes', async (degres) => {
    await expect(
      decodeQrCode(photographie({ inclinaisonX: degres, inclinaisonY: degres * 0.6 })),
    ).resolves.toBe(PRENOM);
  });

  it('décode une photo inclinée ET tournée', async () => {
    await expect(
      decodeQrCode(photographie({ inclinaisonX: 30, inclinaisonY: 15, rotation: 25 })),
    ).resolves.toBe(PRENOM);
  });
});

describe('photo tournée dans son plan', () => {
  it.each([40, 90, 135, 180])('décode une rotation de %i°', async (degres) => {
    await expect(decodeQrCode(photographie({ rotation: degres }))).resolves.toBe(PRENOM);
  });
});

describe('petite étiquette dans une grande photo', () => {
  it.each([500, 300, 200, 150])('décode une étiquette de %i px dans du 3000×2000', async (px) => {
    await expect(decodeQrCode(photographie({ taille: px }))).resolves.toBe(PRENOM);
  });

  it('décode une étiquette de 250 px inclinée à 30°', async () => {
    await expect(
      decodeQrCode(photographie({ taille: 250, inclinaisonX: 30, inclinaisonY: 15 })),
    ).resolves.toBe(PRENOM);
  });
});

describe('limites assumées', () => {
  // Ces cas ne sont décodés par aucun décodeur testé. Le test documente la
  // limite : si un jour l'un passe, c'est une bonne nouvelle à constater, pas
  // une régression à corriger.
  it('ne décode pas au-delà de 60° d’inclinaison', async () => {
    await expect(decodeQrCode(photographie({ inclinaisonX: 65 }))).resolves.toBe('');
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
