import { describe, expect, it } from 'vitest';
import { nomLibre, planifie, type Entree } from './rangement';

const lea = (date: string): Entree => ({ prenom: 'Léa', date, ext: 'jpg' });
const noe = (date: string): Entree => ({ prenom: 'Noé', date, ext: 'jpg' });
const vide = (date: string): Entree => ({ prenom: '', date, ext: 'jpg' });

const JOUR = '2026-06-14';
const LENDEMAIN = '2026-06-15';

describe('planifie', () => {
  it('numérote par prénom et par jour', () => {
    const plans = planifie([lea(JOUR), lea(JOUR), noe(JOUR), lea(LENDEMAIN)], 'prenom_date_num');
    expect(plans.map((p) => p?.nom)).toEqual([
      'Léa_2026-06-14_01.jpg',
      'Léa_2026-06-14_02.jpg',
      'Noé_2026-06-14_01.jpg',
      'Léa_2026-06-15_01.jpg',
    ]);
  });

  it('sans date dans le nom, le compteur continue d’un jour à l’autre', () => {
    const plans = planifie([lea(JOUR), lea(LENDEMAIN)], 'prenom_num');
    expect(plans.map((p) => p?.nom)).toEqual(['Léa_01.jpg', 'Léa_02.jpg']);
  });

  it('ignore les entrées sans prénom', () => {
    const plans = planifie([lea(JOUR), vide(JOUR), lea(JOUR)], 'prenom_date_num');
    expect(plans[1]).toBeNull();
    expect(plans[2]?.numero).toBe(2);
  });
});

describe('nomLibre', () => {
  const disque = (noms: string[]) => (nom: string) => Promise.resolve(noms.includes(nom));

  it('garde le numéro prévu quand la place est libre', async () => {
    const res = await nomLibre('prenom_date_num', lea(JOUR), 1, disque([]));
    expect(res).toEqual({ numero: 1, nom: 'Léa_2026-06-14_01.jpg' });
  });

  it('avance tant que le fichier existe déjà', async () => {
    const occupes = ['Léa_2026-06-14_01.jpg', 'Léa_2026-06-14_02.jpg'];
    const res = await nomLibre('prenom_date_num', lea(JOUR), 1, disque(occupes));
    expect(res).toEqual({ numero: 3, nom: 'Léa_2026-06-14_03.jpg' });
  });

  it('s’arrête au lieu de boucler à l’infini', async () => {
    const res = await nomLibre('prenom_date_num', lea(JOUR), 1, () => Promise.resolve(true));
    expect(res.numero).toBe(999);
  });
});

describe('deuxième passage sur les mêmes photos', () => {
  it('n’écrase rien et reprend la numérotation à la suite', async () => {
    const disque = new Set<string>();
    const existe = (nom: string) => Promise.resolve(disque.has(nom));
    const entrees = [lea(JOUR), lea(JOUR)];

    for (let passage = 0; passage < 2; passage++) {
      const plans = planifie(entrees, 'prenom_date_num');
      for (const [index, entree] of entrees.entries()) {
        const depart = plans[index]?.numero ?? 1;
        const { nom } = await nomLibre('prenom_date_num', entree, depart, existe);
        disque.add(nom);
      }
    }

    expect([...disque].sort()).toEqual([
      'Léa_2026-06-14_01.jpg',
      'Léa_2026-06-14_02.jpg',
      'Léa_2026-06-14_03.jpg',
      'Léa_2026-06-14_04.jpg',
    ]);
  });
});
