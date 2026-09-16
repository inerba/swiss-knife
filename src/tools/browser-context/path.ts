export const OUTLINE_CLASS = 'swiss-inspector-outline';
const STATE_CLASS = /^(active|hover|focus|selected|open)$/i;

function escapeCss(value: string) {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') return CSS.escape(value);
  return value.replace(/[^a-zA-Z0-9_-]/g, character => `\\${character}`);
}

export function selectorSegment(element: Element): string {
  const tag = element.localName;
  if (element.id) return `${tag}#${escapeCss(element.id)}`;
  const classes = [...element.classList]
    .filter(name => name && name !== OUTLINE_CLASS && !STATE_CLASS.test(name))
    .slice(0, 3)
    .map(name => `.${escapeCss(name)}`)
    .join('');
  if (classes) return `${tag}${classes}`;
  const parent = element.parentElement;
  if (!parent) return tag;
  const siblings = [...parent.children].filter(child => child.localName === tag);
  return siblings.length > 1 ? `${tag}:nth-of-type(${siblings.indexOf(element) + 1})` : tag;
}

export function selectorPath(element: Element): string {
  const segments: string[] = [];
  let current: Element | null = element;
  while (current && segments.length < 8) {
    segments.unshift(selectorSegment(current));
    if (current.id) break;
    current = current.parentElement;
  }
  return segments.join(' > ');
}
