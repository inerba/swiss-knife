import { playwrightLocators } from './locators';
import { OUTLINE_CLASS, STATE_CLASS, escapeCss } from './path';
import type { SelectorSuggestion } from './types';

const XHTML = 'http://www.w3.org/1999/xhtml';
const TEST_ATTRIBUTES = ['data-testid', 'data-test', 'data-test-id', 'data-cy', 'data-qa'];
const NAMED_ATTRIBUTES = ['name', 'aria-label', 'placeholder'];
const XPATH_NUMBER = 1;
const XPATH_FIRST_NODE = 9;
const MAX_TEXT = 60;
const MAX_HREF = 120;

// Ids and classes produced by bundlers, CSS-in-JS or frameworks change on every
// build or render: a scraper cannot rely on them.
export function isStableToken(token: string) {
  if (!token || token.length > 60) return false;
  if (/[:[\]/@!()%]/.test(token)) return false;
  if (/\d{3,}/.test(token)) return false;
  if (/^(css|sc|jsx|emotion|svelte|chakra|mui)-/i.test(token)) return false;
  if (/^[A-Za-z0-9]{10,}$/.test(token) && /\d/.test(token) && /[A-Z]/.test(token) && /[a-z]/.test(token)) return false;
  return true;
}

function cssString(value: string) {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

export function xpathLiteral(value: string) {
  if (!value.includes("'")) return `'${value}'`;
  if (!value.includes('"')) return `"${value}"`;
  return `concat(${value.split("'").map(part => `'${part}'`).join(`, "'", `)})`;
}

export function countCss(root: ParentNode, selector: string) {
  try {
    return root.querySelectorAll(selector).length;
  } catch {
    return 0;
  }
}

export function countXPath(doc: Document, expression: string) {
  try {
    return doc.evaluate(`count(${expression})`, doc, null, XPATH_NUMBER, null).numberValue;
  } catch {
    return 0;
  }
}

function firstXPath(doc: Document, expression: string) {
  try {
    return doc.evaluate(expression, doc, null, XPATH_FIRST_NODE, null).singleNodeValue;
  } catch {
    return null;
  }
}

function stableClasses(element: Element) {
  return [...element.classList].filter(name => name !== OUTLINE_CLASS && !STATE_CLASS.test(name) && isStableToken(name));
}

function queryRoot(element: Element) {
  return element.getRootNode() as Document | ShadowRoot;
}

function ownCssCandidates(element: Element) {
  const tag = element.localName;
  const candidates: string[] = [];
  if (element.id && isStableToken(element.id)) candidates.push(`#${escapeCss(element.id)}`);
  for (const attribute of TEST_ATTRIBUTES) {
    const value = element.getAttribute(attribute);
    if (value) candidates.push(`[${attribute}=${cssString(value)}]`);
  }
  for (const attribute of NAMED_ATTRIBUTES) {
    const value = element.getAttribute(attribute);
    if (value) candidates.push(`${tag}[${attribute}=${cssString(value)}]`);
  }
  const href = element.getAttribute('href');
  if (tag === 'a' && href && href.length <= MAX_HREF) candidates.push(`a[href=${cssString(href)}]`);
  const classes = stableClasses(element).slice(0, 3).map(name => `.${escapeCss(name)}`);
  for (const name of classes) candidates.push(`${tag}${name}`);
  if (classes.length > 1) candidates.push(`${tag}${classes.join('')}`);
  candidates.push(tag);
  return candidates;
}

function nthOfType(element: Element) {
  const parent = element.parentElement;
  if (!parent) return element.localName;
  const siblings = [...parent.children].filter(child => child.localName === element.localName);
  return `${element.localName}:nth-of-type(${siblings.indexOf(element) + 1})`;
}

export function cssFull(element: Element): string {
  const segments: string[] = [];
  for (let current: Element | null = element; current; current = current.parentElement) {
    const tag = current.localName;
    segments.unshift(tag === 'html' || tag === 'body' ? tag : nthOfType(current));
  }
  return segments.join(' > ');
}

export function cssShort(element: Element): string {
  const root = queryRoot(element);
  const pointsAtElement = (selector: string) => countCss(root, selector) === 1 && root.querySelector(selector) === element;
  const own = ownCssCandidates(element);
  const direct = own.find(pointsAtElement);
  if (direct) return direct;

  for (let ancestor = element.parentElement; ancestor; ancestor = ancestor.parentElement) {
    const anchor = ownCssCandidates(ancestor)
      .filter(candidate => candidate !== ancestor.localName)
      .find(candidate => countCss(root, candidate) === 1);
    if (!anchor) continue;
    const descendant = own.map(candidate => `${anchor} ${candidate}`).find(pointsAtElement);
    if (descendant) return descendant;
    const chain: string[] = [];
    for (let current: Element | null = element; current && current !== ancestor; current = current.parentElement) {
      chain.unshift(nthOfType(current));
    }
    const structural = `${anchor} > ${chain.join(' > ')}`;
    if (pointsAtElement(structural)) return structural;
    break;
  }
  return cssFull(element);
}

function xpathName(element: Element) {
  return !element.namespaceURI || element.namespaceURI === XHTML
    ? element.localName
    : `*[local-name()='${element.localName}']`;
}

function xpathStep(element: Element) {
  const parent = element.parentElement;
  const name = xpathName(element);
  if (!parent) return name;
  const siblings = [...parent.children].filter(child => child.localName === element.localName && child.namespaceURI === element.namespaceURI);
  return siblings.length > 1 ? `${name}[${siblings.indexOf(element) + 1}]` : name;
}

export function xpathAbsolute(element: Element): string {
  const steps: string[] = [];
  for (let current: Element | null = element; current; current = current.parentElement) steps.unshift(xpathStep(current));
  return `/${steps.join('/')}`;
}

function anchorPredicates(element: Element) {
  const predicates: string[] = [];
  if (element.id && isStableToken(element.id)) predicates.push(`@id=${xpathLiteral(element.id)}`);
  for (const attribute of TEST_ATTRIBUTES) {
    const value = element.getAttribute(attribute);
    if (value) predicates.push(`@${attribute}=${xpathLiteral(value)}`);
  }
  return predicates;
}

function ownPredicates(element: Element) {
  const predicates = anchorPredicates(element);
  for (const attribute of NAMED_ATTRIBUTES) {
    const value = element.getAttribute(attribute);
    if (value) predicates.push(`@${attribute}=${xpathLiteral(value)}`);
  }
  for (const name of stableClasses(element).slice(0, 3)) {
    predicates.push(`contains(concat(' ', normalize-space(@class), ' '), ${xpathLiteral(` ${name} `)})`);
  }
  return predicates;
}

export function xpathRelative(element: Element): string {
  const doc = element.ownerDocument;
  const pointsAtElement = (expression: string) => countXPath(doc, expression) === 1 && firstXPath(doc, expression) === element;
  const direct = ownPredicates(element).map(predicate => `//${xpathName(element)}[${predicate}]`).find(pointsAtElement);
  if (direct) return direct;

  for (let ancestor = element.parentElement; ancestor; ancestor = ancestor.parentElement) {
    const anchor = anchorPredicates(ancestor)
      .map(predicate => `//${xpathName(ancestor)}[${predicate}]`)
      .find(expression => countXPath(doc, expression) === 1);
    if (!anchor) continue;
    const steps: string[] = [];
    for (let current: Element | null = element; current && current !== ancestor; current = current.parentElement) steps.unshift(xpathStep(current));
    const expression = `${anchor}/${steps.join('/')}`;
    if (pointsAtElement(expression)) return expression;
    break;
  }
  return xpathAbsolute(element);
}

export function xpathText(element: Element): string | null {
  const text = (element.textContent ?? '').replace(/\s+/g, ' ').trim();
  if (!text || text.length > MAX_TEXT) return null;
  return `//${xpathName(element)}[normalize-space()=${xpathLiteral(text)}]`;
}

export function buildSelectors(element: Element): SelectorSuggestion[] {
  const root = queryRoot(element);
  const suggestions: SelectorSuggestion[] = [];
  const addCss = (kind: SelectorSuggestion['kind'], value: string) => {
    suggestions.push({ kind, value, matches: countCss(root, value), estimated: false });
  };
  addCss('css-short', cssShort(element));
  addCss('css-full', cssFull(element));
  // XPath cannot address nodes inside a shadow root.
  if (root === element.ownerDocument) {
    const doc = element.ownerDocument;
    const addXPath = (kind: SelectorSuggestion['kind'], value: string | null) => {
      if (value) suggestions.push({ kind, value, matches: countXPath(doc, value), estimated: false });
    };
    addXPath('xpath-relative', xpathRelative(element));
    addXPath('xpath-absolute', xpathAbsolute(element));
    addXPath('xpath-text', xpathText(element));
  }
  for (const locator of playwrightLocators(element)) suggestions.push({ kind: 'playwright', ...locator });
  return suggestions;
}
