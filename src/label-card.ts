// One label, as an element. It sits outside labels.ts because the home page
// shows a real one next to the title rather than a drawing of one, and a
// drawing would be free to drift away from what the printer produces.

import { labelTheme, type LabelOptions, type LabelSize } from './label-theme';
import { BOX, GAP, MASCOT_RATIO, PAGE, printableArea, sheetLayout } from './label-layout';

/**
 * Hands the sheet's measurements to the stylesheet. Every length a label is
 * made of comes from label-layout.ts, so what the page count was computed with
 * and what the browser draws cannot drift apart.
 */
export function applyLayout(element: HTMLElement, size: LabelSize): void {
  const layout = sheetLayout(size);
  const variables: Record<string, string> = {
    '--paper-width': mm(printableArea().width),
    '--paper-margin': mm(PAGE.margin),
    '--label-gap': mm(GAP),
    '--columns': String(layout.columns),
    '--label-width': mm(layout.labelWidth),
    '--label-height': mm(layout.labelHeight),
    '--label-border': mm(BOX.border),
    '--label-padding': mm(BOX.padding),
    '--frame-padding': mm(BOX.framePadding),
    '--caption-gap': mm(BOX.captionGap),
    '--caption-height': mm(layout.captionHeight),
    '--qr-size': mm(layout.qrSize),
    '--name-size': mm(layout.nameSize),
    '--mascot-size': mm(layout.nameSize * MASCOT_RATIO),
  };
  for (const [name, value] of Object.entries(variables)) element.style.setProperty(name, value);
}

function mm(length: number): string {
  return `${String(Math.round(length * 100) / 100)}mm`;
}

export function labelCard(firstName: string, svg: string, options: LabelOptions): HTMLDivElement {
  const theme = labelTheme(firstName, options);

  const card = document.createElement('div');
  card.className = 'label-card';
  card.style.setProperty('--ink', theme.ink);
  card.style.setProperty('--tint', theme.tint);

  const frame = document.createElement('div');
  frame.className = 'label-qr';
  // `svg` is built by us from the QR matrix, not from user input: only the
  // first name is typed, and it goes through textContent just below.
  frame.innerHTML = svg;
  card.append(frame);

  const caption = document.createElement('div');
  caption.className = 'label-name';

  if (theme.mascot) {
    const mascot = document.createElement('span');
    // Decoration only: a screen reader announcing « renard » before the name
    // would help nobody.
    mascot.setAttribute('aria-hidden', 'true');
    mascot.className = 'label-mascot';
    mascot.textContent = theme.mascot;
    caption.append(mascot);
  }

  const name = document.createElement('span');
  name.textContent = firstName;
  caption.append(name);

  card.append(caption);
  return card;
}
