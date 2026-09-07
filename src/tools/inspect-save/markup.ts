import { curatedStyleProperties } from './sample';

const BLOCKED_TAGS = new Set(['script', 'style', 'link', 'meta', 'noscript', 'template']);
const EVENT_ATTR = /^on/i;

function sanitizeAttributes(element: Element) {
  for (const attribute of [...element.attributes]) {
    const name = attribute.name.toLowerCase();
    if (EVENT_ATTR.test(name)) element.removeAttribute(attribute.name);
    else if (name === 'href' && attribute.value.trim().toLowerCase().startsWith('javascript:')) element.removeAttribute(attribute.name);
    else if (name === 'src' && attribute.value.trim().toLowerCase().startsWith('javascript:')) element.removeAttribute(attribute.name);
  }
}

function collectElements(root: Element | DocumentFragment | ShadowRoot, list: Element[] = []): Element[] {
  for (const node of root.children ?? []) {
    if (!(node instanceof Element)) continue;
    if (BLOCKED_TAGS.has(node.localName)) continue;
    list.push(node);
    if (node.shadowRoot) collectElements(node.shadowRoot, list);
    collectElements(node, list);
  }
  return list;
}

function cloneNodeTree(element: Element): Element {
  const clone = element.cloneNode(false) as Element;
  sanitizeAttributes(clone);
  if (element.shadowRoot) {
    for (const child of [...element.shadowRoot.children]) {
      if (child instanceof Element && !BLOCKED_TAGS.has(child.localName)) clone.append(cloneNodeTree(child));
    }
  }
  for (const child of element.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) clone.append(child.cloneNode());
    else if (child instanceof Element && !BLOCKED_TAGS.has(child.localName)) clone.append(cloneNodeTree(child));
  }
  return clone;
}

function classNameFor(original: Element, index: number) {
  const base = original.localName.toLowerCase().replace(/[^a-z0-9-]/g, '') || 'node';
  return `swiss-export-${base}-${index}`;
}

function buildCssRules(elements: Element[], originals: Element[]): string {
  const rules: string[] = [];
  elements.forEach((clone, index) => {
    const original = originals[index];
    if (!original) return;
    const style = getComputedStyle(original);
    const props = curatedStyleProperties(style);
    const entries = Object.entries(props)
      .map(([property, value]) => `  ${property}: ${value};`)
      .join('\n');
    if (entries) rules.push(`.${classNameFor(original, index)} {\n${entries}\n}`);
  });
  return rules.join('\n\n');
}

export function sanitizeMarkup(html: string): string {
  const template = document.createElement('template');
  template.innerHTML = html;
  for (const element of template.content.querySelectorAll('*')) sanitizeAttributes(element);
  const root = template.content.firstElementChild;
  return root?.outerHTML ?? html;
}

export function buildMarkupSnippet(element: Element): string {
  const clone = cloneNodeTree(element);
  const originals = [element, ...collectElements(element)];
  const clones = [clone, ...collectElements(clone)];
  originals.forEach((original, index) => {
    const target = clones[index];
    if (!target) return;
    target.className = classNameFor(original, index);
    sanitizeAttributes(target);
  });
  const css = buildCssRules(clones, originals);
  const html = clone.outerHTML;
  return `<style>\n${css}\n</style>\n${html}`;
}

export function buildMarkupFromHtml(elementHtml: string, css: string): string {
  return `<style>\n${css}\n</style>\n${elementHtml}`;
}
