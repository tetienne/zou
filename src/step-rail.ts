// The trail of steps at the top of the two working pages. It follows what the
// teacher has actually done rather than what is on screen, since every step of
// a page is on screen at once.

import { icon } from './icons';

/**
 * Writes the state of each step into the trail.
 *
 * @param steps the `<li>` of the trail, in order
 * @param done one entry per step: whether it is behind her
 * @param current the step she is in, counted from 1; 0 once all of them are done
 */
export function showRail(steps: readonly Element[], done: boolean[], current: number): void {
  steps.forEach((step, index) => {
    const number = index + 1;
    const isDone = done[index] === true;
    step.classList.toggle('is-done', isDone);
    step.classList.toggle('is-current', number === current);
    if (number === current) step.setAttribute('aria-current', 'step');
    else step.removeAttribute('aria-current');

    // A tick rather than a number, and « faite » rather than the step alone:
    // a done step never reads by colour alone.
    const disc = step.querySelector('.step-disc');
    if (disc) {
      disc.textContent = isDone ? '' : String(number);
      if (isDone) disc.append(icon('ready', 'size-5'));
    }

    const kicker = step.querySelector('.eyebrow');
    if (kicker) {
      kicker.textContent = isDone
        ? `Étape ${String(number)} · faite`
        : number === current
          ? `Étape ${String(number)} · en cours`
          : `Étape ${String(number)}`;
    }
  });
}
