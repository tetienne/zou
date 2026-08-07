/**
 * Fetches an element from the page and checks its type at runtime.
 *
 * The constructor is passed as an argument rather than inferred from an `as`
 * cast: if an id disappears from the page or changes nature (a `<span>` turned
 * into a `<div>`), the error surfaces on load naming the culprit, instead of a
 * "cannot read properties of null" a few lines further down.
 */
export function required<T extends HTMLElement>(id: string, type: abstract new () => T): T {
  const element = document.getElementById(id);
  if (element === null) throw new Error(`Element "${id}" not found`);
  if (!(element instanceof type)) {
    throw new Error(`Element "${id}": expected ${type.name}, found ${element.constructor.name}`);
  }
  return element;
}
