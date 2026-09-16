export interface LocatorSuggestion {
  value: string;
  matches: number;
  estimated: boolean;
}

const MAX_LOCATORS = 3;
const MAX_TEXT = 60;
const MAX_NAME = 80;

// Roles whose accessible name comes from the element's text content.
const NAME_FROM_CONTENT = new Set([
  'button', 'cell', 'checkbox', 'columnheader', 'heading', 'link', 'menuitem',
  'option', 'radio', 'rowheader', 'switch', 'tab', 'tooltip', 'treeitem',
]);
// Landmarks are useful locators even without a name.
const NAMELESS_ROLES = new Set(['banner', 'complementary', 'contentinfo', 'main', 'navigation']);

function normalize(text: string | null | undefined) {
  return (text ?? '').replace(/\s+/g, ' ').trim();
}

export function jsString(value: string) {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

function cssString(value: string) {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function safeCount(root: ParentNode, selector: string) {
  try {
    return root.querySelectorAll(selector).length;
  } catch {
    return 0;
  }
}

function inputRole(input: HTMLInputElement) {
  const type = (input.getAttribute('type') ?? 'text').toLowerCase();
  if (['button', 'image', 'reset', 'submit'].includes(type)) return 'button';
  if (type === 'checkbox' || type === 'radio') return type;
  if (type === 'range') return 'slider';
  if (type === 'number') return 'spinbutton';
  if (type === 'search') return input.hasAttribute('list') ? 'combobox' : 'searchbox';
  if (['email', 'tel', 'text', 'url'].includes(type)) return input.hasAttribute('list') ? 'combobox' : 'textbox';
  return null;
}

export function implicitRole(element: Element): string | null {
  const explicit = element.getAttribute('role')?.trim().split(/\s+/)[0];
  if (explicit) return explicit;
  const tag = element.localName;
  if ((tag === 'a' || tag === 'area') && element.hasAttribute('href')) return 'link';
  if (/^h[1-6]$/.test(tag)) return 'heading';
  if (tag === 'input') return inputRole(element as HTMLInputElement);
  if (tag === 'select') {
    const select = element as HTMLSelectElement;
    return select.multiple || select.size > 1 ? 'listbox' : 'combobox';
  }
  if (tag === 'img') return element.getAttribute('alt') === '' ? null : 'img';
  const roles: Record<string, string> = {
    article: 'article', aside: 'complementary', button: 'button', dialog: 'dialog',
    footer: 'contentinfo', form: 'form', header: 'banner', li: 'listitem', main: 'main',
    nav: 'navigation', ol: 'list', option: 'option', progress: 'progressbar', table: 'table',
    td: 'cell', textarea: 'textbox', th: 'columnheader', tr: 'row', ul: 'list',
  };
  return roles[tag] ?? null;
}

function isLabelable(element: Element) {
  const tag = element.localName;
  if (tag === 'select' || tag === 'textarea' || tag === 'meter' || tag === 'output' || tag === 'progress') return true;
  return tag === 'input' && (element.getAttribute('type') ?? '').toLowerCase() !== 'hidden';
}

// Text of the <label> elements pointing at a form control, without the control itself.
export function labelText(element: Element): string {
  if (!isLabelable(element)) return '';
  const labels = new Set<Element>();
  const closest = element.closest('label');
  if (closest) labels.add(closest);
  if (element.id) {
    const root = element.getRootNode() as ParentNode;
    for (const label of safeLabels(root, element.id)) labels.add(label);
  }
  return normalize([...labels].map(label => {
    const clone = label.cloneNode(true) as Element;
    clone.querySelectorAll('input, select, textarea').forEach(control => control.remove());
    return clone.textContent;
  }).join(' '));
}

function safeLabels(root: ParentNode, id: string) {
  try {
    return [...root.querySelectorAll(`label[for=${cssString(id)}]`)];
  } catch {
    return [];
  }
}

export function accessibleName(element: Element): string {
  const labelledBy = element.getAttribute('aria-labelledby');
  if (labelledBy) {
    const doc = element.ownerDocument;
    const text = normalize(labelledBy.split(/\s+/).map(id => doc.getElementById(id)?.textContent ?? '').join(' '));
    if (text) return text;
  }
  const ariaLabel = normalize(element.getAttribute('aria-label'));
  if (ariaLabel) return ariaLabel;
  const label = labelText(element);
  if (label) return label;
  const tag = element.localName;
  if (tag === 'img' || tag === 'area') {
    const alt = normalize(element.getAttribute('alt'));
    if (alt) return alt;
  }
  if (tag === 'input' && ['button', 'reset', 'submit'].includes((element.getAttribute('type') ?? '').toLowerCase())) {
    const value = normalize(element.getAttribute('value'));
    if (value) return value;
  }
  const role = implicitRole(element);
  if (role && NAME_FROM_CONTENT.has(role)) {
    const text = normalize(element.textContent);
    if (text) return text;
  }
  return normalize(element.getAttribute('title'));
}

function allElements(root: ParentNode) {
  return [...root.querySelectorAll('*')];
}

// Approximates Playwright's getByText: the innermost elements whose whole text matches.
function countText(root: ParentNode, text: string) {
  return allElements(root).filter(candidate => normalize(candidate.textContent) === text
    && ![...candidate.children].some(child => normalize(child.textContent) === text)).length;
}

export function playwrightLocators(element: Element): LocatorSuggestion[] {
  const root = element.getRootNode() as ParentNode;
  const locators: LocatorSuggestion[] = [];

  const testId = element.getAttribute('data-testid');
  if (testId) {
    locators.push({ value: `getByTestId(${jsString(testId)})`, matches: safeCount(root, `[data-testid=${cssString(testId)}]`), estimated: false });
  }

  const role = implicitRole(element);
  const name = accessibleName(element);
  if (role && name && name.length <= MAX_NAME) {
    const matches = allElements(root).filter(candidate => implicitRole(candidate) === role && accessibleName(candidate) === name).length;
    locators.push({ value: `getByRole(${jsString(role)}, { name: ${jsString(name)}, exact: true })`, matches, estimated: true });
  } else if (role && NAMELESS_ROLES.has(role)) {
    const matches = allElements(root).filter(candidate => implicitRole(candidate) === role).length;
    locators.push({ value: `getByRole(${jsString(role)})`, matches, estimated: true });
  }

  const label = labelText(element);
  if (label && label.length <= MAX_NAME) {
    const matches = allElements(root).filter(candidate => labelText(candidate) === label).length;
    locators.push({ value: `getByLabel(${jsString(label)}, { exact: true })`, matches, estimated: true });
  }

  const placeholder = element.getAttribute('placeholder');
  if (placeholder) {
    locators.push({ value: `getByPlaceholder(${jsString(placeholder)}, { exact: true })`, matches: safeCount(root, `[placeholder=${cssString(placeholder)}]`), estimated: false });
  }

  const alt = element.getAttribute('alt');
  if (alt) {
    locators.push({ value: `getByAltText(${jsString(alt)}, { exact: true })`, matches: safeCount(root, `[alt=${cssString(alt)}]`), estimated: false });
  }

  const text = normalize(element.textContent);
  if (text && text.length <= MAX_TEXT) {
    locators.push({ value: `getByText(${jsString(text)}, { exact: true })`, matches: countText(root, text), estimated: true });
  }

  return locators.slice(0, MAX_LOCATORS);
}
