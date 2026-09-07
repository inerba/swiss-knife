const INSPECTOR_CLASS = 'swiss-inspector-outline';

function escapeCss(value: string) {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') return CSS.escape(value);
  return value.replace(/[^a-zA-Z0-9_-]/g, '\\$&');
}

export function inspectorOutlineClass() {
  return INSPECTOR_CLASS;
}

export function buildSelector(element: Element): string {
  const tag = element.localName.toLowerCase();
  if (element.id) return `${tag}#${escapeCss(element.id)}`;
  const classes = [...element.classList].filter(name => name !== INSPECTOR_CLASS);
  if (classes.length) return `${tag}.${classes.map(name => escapeCss(name)).join('.')}`;
  const parent = element.parentElement;
  if (!parent) return tag;
  const siblings = [...parent.children].filter(child => child.localName === element.localName);
  if (siblings.length <= 1) return `${buildSelector(parent)} > ${tag}`;
  const index = siblings.indexOf(element) + 1;
  return `${buildSelector(parent)} > ${tag}:nth-of-type(${index})`;
}

export function formatClasses(element: Element): string {
  const classes = [...element.classList].filter(name => name !== INSPECTOR_CLASS);
  return classes.length ? classes.map(name => `.${name}`).join(' ') : '—';
}

export function formatTagLabel(tag: string): string {
  const normalized = tag.toLowerCase();
  if (!normalized) return 'Elemento';
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}
