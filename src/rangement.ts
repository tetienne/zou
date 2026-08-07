// Numérotation et attribution des noms de fichiers.
// Sans DOM ni accès disque : le seul contact avec le monde extérieur est le
// prédicat `existe`, ce qui rend toute la logique testable.

import { cleCompteur, nomFichier, type Modele } from './noms';

export interface Entree {
  prenom: string;
  date: string;
  ext: string;
}

export interface Attribution {
  numero: number;
  nom: string;
}

/**
 * Numérote une série de photos dans l'ordre : deux travaux de Léa le même jour
 * deviennent `Léa_…_01` et `Léa_…_02`. Une entrée sans prénom n'est pas nommée.
 */
export function planifie(entrees: readonly Entree[], modele: Modele): (Attribution | null)[] {
  const compteurs = new Map<string, number>();
  return entrees.map((entree) => {
    if (!entree.prenom) return null;
    const cle = cleCompteur(modele, entree.prenom, entree.date);
    const numero = (compteurs.get(cle) ?? 0) + 1;
    compteurs.set(cle, numero);
    return { numero, nom: nomFichier(modele, entree.prenom, entree.date, numero, entree.ext) };
  });
}

/** Nombre maximal de photos pour un même prénom et une même date. */
const NUMERO_MAX = 999;

/**
 * Avance le numéro tant qu'un fichier du même nom existe déjà, pour que
 * relancer le rangement une deuxième fois n'écrase jamais rien.
 */
export async function nomLibre(
  modele: Modele,
  entree: Entree,
  depart: number,
  existe: (nom: string) => Promise<boolean>,
): Promise<Attribution> {
  let numero = depart;
  let nom = nomFichier(modele, entree.prenom, entree.date, numero, entree.ext);
  while (numero < NUMERO_MAX && (await existe(nom))) {
    numero++;
    nom = nomFichier(modele, entree.prenom, entree.date, numero, entree.ext);
  }
  return { numero, nom };
}
