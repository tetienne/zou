// Tout ce qui touche aux prénoms et aux noms de fichiers.
// Volontairement sans DOM : ces fonctions sont testées unitairement.

/** Formats d'image que le navigateur sait décoder. */
export const EXTENSIONS_LUES = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'avif'] as const;

/** Formats reconnus comme des photos, y compris ceux qu'on ne sait pas lire. */
export const EXTENSIONS_CONNUES = [...EXTENSIONS_LUES, 'heic', 'heif'] as const;

export type Modele = 'prenom_date_num' | 'prenom_num' | 'date_prenom_num';

export function extension(nom: string): string {
  const point = nom.lastIndexOf('.');
  return point === -1 ? '' : nom.slice(point + 1).toLowerCase();
}

export function estImage(nom: string): boolean {
  return (EXTENSIONS_CONNUES as readonly string[]).includes(extension(nom));
}

export function estLisible(nom: string): boolean {
  return (EXTENSIONS_LUES as readonly string[]).includes(extension(nom));
}

/**
 * Le QR contient normalement le prénom tel quel. On accepte aussi les formes
 * « prenom:Léa » ou une adresse du type « …?prenom=Léa », au cas où les
 * étiquettes soient produites par un autre outil.
 */
export function extraitPrenom(brut: string): string {
  let valeur = brut.trim();
  const parametre = /[?&](?:prenom|pr%C3%A9nom|nom|name)=([^&#]+)/i.exec(valeur);
  if (parametre?.[1]) {
    try {
      valeur = decodeURIComponent(parametre[1].replace(/\+/g, ' '));
    } catch {
      valeur = parametre[1];
    }
  } else {
    valeur = valeur.replace(/^(?:prenom|prénom|nom|name|eleve|élève)\s*[:=]\s*/i, '');
  }
  return valeur.trim();
}

const CARACTERES_INTERDITS = /[<>:"/\\|?*]|[\p{Cc}\p{Cf}]/gu;

/**
 * Retire les caractères interdits dans un nom de fichier Windows.
 * Les accents et les traits d'union internes sont conservés.
 */
export function nettoiePourFichier(texte: string): string {
  const propre = texte
    .replace(CARACTERES_INTERDITS, '')
    .replace(/\s+/g, '-')
    .replace(/^[.\-\s]+|[.\-\s]+$/g, '')
    .slice(0, 60);
  return propre || 'Sans-nom';
}

/** Date du fichier photo, au format AAAA-MM-JJ. */
export function dateDuFichier(quand: number): string {
  const d = new Date(quand);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function nomFichier(
  modele: Modele,
  prenom: string,
  date: string,
  numero: number,
  ext: string,
): string {
  const n = String(numero).padStart(2, '0');
  const base =
    modele === 'prenom_num'
      ? `${prenom}_${n}`
      : modele === 'date_prenom_num'
        ? `${date}_${prenom}_${n}`
        : `${prenom}_${date}_${n}`;
  return ext ? `${base}.${ext}` : base;
}

/**
 * Clé de numérotation : sans la date dans le nom de fichier, le compteur doit
 * continuer d'un jour à l'autre au lieu de repartir de 01.
 */
export function cleCompteur(modele: Modele, prenom: string, date: string): string {
  return modele === 'prenom_num' ? prenom : `${prenom}|${date}`;
}
