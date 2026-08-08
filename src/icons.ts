// The small icons of the interface, all from one set. A state is never carried
// by colour alone: every badge, tally and callout pairs its colour with one of
// these and with a word.

const ICON_PATHS: Record<string, string> = {
  ready: '<path d="m20 6-11 11-5-5"/>',
  warning:
    '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>' +
    '<path d="M12 9v4"/><path d="M12 17h.01"/>',
  forbidden: '<circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/>',
  copied: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
  pencil: '<path d="M12 4v10"/><path d="M12 19h.01"/>',
  waiting: '<circle cx="12" cy="12" r="4"/>',
};

export function icon(name: string, className = ''): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  if (className) svg.setAttribute('class', className);
  svg.innerHTML = ICON_PATHS[name] ?? '';
  return svg;
}
