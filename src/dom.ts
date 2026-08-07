/**
 * Récupère un élément de la page et vérifie son type à l'exécution.
 *
 * Le constructeur est passé en paramètre plutôt que déduit d'un `as` : si un
 * identifiant disparaît de la page ou change de nature (un `<span>` devenu
 * `<div>`), l'erreur apparaît au chargement avec le nom du coupable, au lieu
 * d'un « cannot read properties of null » quelques lignes plus loin.
 */
export function requis<T extends HTMLElement>(id: string, type: abstract new () => T): T {
  const element = document.getElementById(id);
  if (element === null) throw new Error(`Élément « ${id} » introuvable`);
  if (!(element instanceof type)) {
    throw new Error(`Élément « ${id} » : ${type.name} attendu, ${element.constructor.name} trouvé`);
  }
  return element;
}
