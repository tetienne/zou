import { describe, expect, it } from 'vitest';
import {
  dateDuFichier,
  estImage,
  estLisible,
  extension,
  extraitPrenom,
  nettoiePourFichier,
  nomFichier,
} from './noms';

describe('extraitPrenom', () => {
  it('rend le prénom tel quel', () => {
    expect(extraitPrenom('Léa')).toBe('Léa');
    expect(extraitPrenom('  Marie-Claire \n')).toBe('Marie-Claire');
  });

  it('accepte un préfixe explicite', () => {
    expect(extraitPrenom('prenom: Noé')).toBe('Noé');
    expect(extraitPrenom('élève=Youssef')).toBe('Youssef');
  });

  it('accepte une adresse avec paramètre', () => {
    expect(extraitPrenom('https://ex.fr/e?prenom=Marie%20Claire')).toBe('Marie Claire');
    expect(extraitPrenom('https://ex.fr/e?a=1&nom=L%C3%A9a#x')).toBe('Léa');
  });

  it('ne casse pas sur un encodage invalide', () => {
    expect(extraitPrenom('https://ex.fr/e?prenom=%E9')).toBe('%E9');
  });
});

describe('nettoiePourFichier', () => {
  it('garde les accents et les traits d’union internes', () => {
    expect(nettoiePourFichier('Léa')).toBe('Léa');
    expect(nettoiePourFichier('Marie-Claire')).toBe('Marie-Claire');
  });

  it('remplace les espaces par des traits d’union', () => {
    expect(nettoiePourFichier('Léa B')).toBe('Léa-B');
  });

  it('retire les caractères interdits sous Windows', () => {
    expect(nettoiePourFichier('a/b:c*d?e"f<g>h|i\\j')).toBe('abcdefghij');
  });

  it('ne rend jamais un nom vide', () => {
    expect(nettoiePourFichier('   ')).toBe('Sans-nom');
    expect(nettoiePourFichier('///')).toBe('Sans-nom');
    expect(nettoiePourFichier('...')).toBe('Sans-nom');
  });

  it('limite la longueur', () => {
    expect(nettoiePourFichier('a'.repeat(200))).toHaveLength(60);
  });
});

describe('nomFichier', () => {
  const args = ['Léa', '2026-06-14', 3, 'jpg'] as const;

  it('applique les trois modèles', () => {
    expect(nomFichier('prenom_date_num', ...args)).toBe('Léa_2026-06-14_03.jpg');
    expect(nomFichier('prenom_num', ...args)).toBe('Léa_03.jpg');
    expect(nomFichier('date_prenom_num', ...args)).toBe('2026-06-14_Léa_03.jpg');
  });

  it('complète le numéro sur deux chiffres', () => {
    expect(nomFichier('prenom_num', 'Léa', '2026-06-14', 1, 'png')).toBe('Léa_01.png');
    expect(nomFichier('prenom_num', 'Léa', '2026-06-14', 100, 'png')).toBe('Léa_100.png');
  });
});

describe('extensions', () => {
  it('reconnaît les images lisibles et les HEIC', () => {
    expect(extension('IMG_001.JPG')).toBe('jpg');
    expect(estLisible('a.jpg')).toBe(true);
    expect(estLisible('a.heic')).toBe(false);
    expect(estImage('a.heic')).toBe(true);
    expect(estImage('notes.txt')).toBe(false);
    expect(estImage('sans-extension')).toBe(false);
  });
});

describe('dateDuFichier', () => {
  it('formate en AAAA-MM-JJ', () => {
    expect(dateDuFichier(new Date(2026, 5, 14, 10, 30).getTime())).toBe('2026-06-14');
    expect(dateDuFichier(new Date(2026, 0, 2).getTime())).toBe('2026-01-02');
  });
});
