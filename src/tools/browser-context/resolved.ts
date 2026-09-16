import { OVERLAY_ATTR } from './css-rules';

export const RESOLVED_LIMIT = 200;

export type StyleValues = Map<string, string>;

const NOISE_PROPERTIES = new Set([
  'block-size', 'inline-size', 'min-block-size', 'min-inline-size',
  'max-block-size', 'max-inline-size', 'perspective-origin', 'transform-origin',
]);
const NOISE_PREFIXES = ['inset-', 'margin-block', 'margin-inline', 'padding-block', 'padding-inline'];
const COLOR_MIRRORS = new Set(['caret-color', 'column-rule-color', 'text-decoration-color', 'text-emphasis-color']);

export const SHORTHAND_GROUPS: Array<[string, (property: string) => boolean]> = [
  ['margin', property => property.startsWith('margin-')],
  ['padding', property => property.startsWith('padding-')],
  ['border-radius', property => /^border-.+-radius$/.test(property)],
  ['border', property => property.startsWith('border-') && !property.endsWith('-radius') && !property.startsWith('border-image')],
];

export function diffComputed(computed: StyleValues, baseline: StyleValues, shorthands: StyleValues): string[] {
  const color = computed.get('color');
  const changed = new Set<string>();
  for (const [property, value] of computed) {
    if (property.startsWith('-') || NOISE_PROPERTIES.has(property)) continue;
    if (NOISE_PREFIXES.some(prefix => property.startsWith(prefix))) continue;
    if (COLOR_MIRRORS.has(property) && value === color) continue;
    if (value !== (baseline.get(property) ?? '')) changed.add(property);
  }
  const lines: string[] = [];
  for (const [shorthand, belongs] of SHORTHAND_GROUPS) {
    const longhands = [...changed].filter(belongs);
    if (!longhands.length) continue;
    const value = shorthands.get(shorthand);
    if (!value) continue;
    lines.push(`${shorthand}: ${value};`);
    longhands.forEach(property => changed.delete(property));
  }
  for (const property of [...changed].sort()) lines.push(`${property}: ${computed.get(property)};`);
  return lines.slice(0, RESOLVED_LIMIT);
}

function readStyle(style: CSSStyleDeclaration): StyleValues {
  const result: StyleValues = new Map();
  for (let index = 0; index < style.length; index++) {
    const property = style[index]!;
    result.set(property, style.getPropertyValue(property));
  }
  return result;
}

// Compare with a pristine element of the same tag so only properties that
// something actually set are reported.
export function readResolvedValues(element: Element, view: Window): string[] {
  const doc = element.ownerDocument;
  const iframe = doc.createElement('iframe');
  iframe.setAttribute(OVERLAY_ATTR, '');
  iframe.style.cssText = 'position:absolute;width:0;height:0;border:0;visibility:hidden;';
  try {
    doc.documentElement.append(iframe);
    const probeDocument = iframe.contentDocument;
    const probeWindow = iframe.contentWindow;
    if (!probeDocument || !probeWindow) return [];
    const probe = probeDocument.createElementNS(element.namespaceURI ?? 'http://www.w3.org/1999/xhtml', element.localName);
    (probeDocument.body ?? probeDocument.documentElement).append(probe);
    const computed = view.getComputedStyle(element);
    const shorthands: StyleValues = new Map(SHORTHAND_GROUPS.map(([name]) => [name, computed.getPropertyValue(name)]));
    return diffComputed(readStyle(computed), readStyle(probeWindow.getComputedStyle(probe)), shorthands);
  } catch {
    return [];
  } finally {
    iframe.remove();
  }
}
