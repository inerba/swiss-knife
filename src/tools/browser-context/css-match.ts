import { formatEntry, formatRule, isNoiseRule, splitDeclarations, type RuleEntry } from './css-rules';
import type { CssContext, PseudoRules, StateRules } from './types';

export const RULE_LIMITS = { matched: 40, media: 15, inherited: 12, group: 20, variables: 40 } as const;

export const INHERITED_PROPERTIES = new Set([
  'border-collapse', 'border-spacing', 'caption-side', 'color', 'cursor',
  'direction', 'empty-cells', 'font', 'font-family', 'font-feature-settings',
  'font-size', 'font-stretch', 'font-style', 'font-variant', 'font-weight',
  'hyphens', 'letter-spacing', 'line-height', 'list-style', 'list-style-image',
  'list-style-position', 'list-style-type', 'overflow-wrap', 'quotes',
  'tab-size', 'text-align', 'text-align-last', 'text-indent', 'text-shadow',
  'text-transform', 'visibility', 'white-space', 'word-break', 'word-spacing',
]);

type StateName = keyof StateRules;

const STATE_PSEUDO = /:(hover|focus-visible|focus-within|focus|active)\b/gi;
const PSEUDO_ELEMENT = /::?(before|after)\b/i;

function safeMatches(element: Element, selector: string) {
  try {
    return element.matches(selector);
  } catch {
    return false;
  }
}

function declarationsOf(entry: RuleEntry) {
  return splitDeclarations(entry.rule.style.cssText);
}

export function matchedRules(element: Element, entries: RuleEntry[]): string[] {
  const rules: string[] = [];
  for (const entry of entries) {
    if (rules.length >= RULE_LIMITS.matched) break;
    const selector = entry.rule.selectorText;
    if (!entry.active || isNoiseRule(selector) || !safeMatches(element, selector)) continue;
    const declarations = declarationsOf(entry);
    if (declarations.length) rules.push(formatEntry(entry, declarations));
  }
  const inline = (element as HTMLElement).style?.cssText;
  if (inline) rules.push(formatRule('element.style', splitDeclarations(inline)));
  return rules;
}

export function otherBreakpointRules(element: Element, entries: RuleEntry[]): string[] {
  const rules: string[] = [];
  for (const entry of entries) {
    if (rules.length >= RULE_LIMITS.media) break;
    const selector = entry.rule.selectorText;
    if (entry.active || isNoiseRule(selector) || !safeMatches(element, selector)) continue;
    const declarations = declarationsOf(entry);
    if (declarations.length) rules.push(formatEntry(entry, declarations));
  }
  return rules;
}

// :hover/:focus/:active never match a static snapshot, so test the selector
// with the state pseudo-classes stripped.
export function statesInSelector(element: Element, selectorText: string): Set<StateName> {
  const states = new Set<StateName>();
  for (const segment of selectorText.split(',')) {
    const trimmed = segment.trim();
    const names = [...trimmed.matchAll(STATE_PSEUDO)].map(match => match[1]!.toLowerCase());
    if (!names.length) continue;
    const stripped = trimmed.replace(STATE_PSEUDO, '').trim();
    if (!stripped || !safeMatches(element, stripped)) continue;
    names.forEach(name => states.add(name.startsWith('focus') ? 'focus' : name as StateName));
  }
  return states;
}

export function stateRules(element: Element, entries: RuleEntry[], matched: string[]): StateRules {
  const states: StateRules = { hover: [], focus: [], active: [] };
  for (const entry of entries) {
    const selector = entry.rule.selectorText;
    if (!entry.active || isNoiseRule(selector)) continue;
    const found = statesInSelector(element, selector);
    if (!found.size) continue;
    const declarations = declarationsOf(entry);
    if (!declarations.length) continue;
    const text = formatEntry(entry, declarations);
    if (matched.includes(text)) continue;
    for (const state of found) {
      if (states[state].length < RULE_LIMITS.group) states[state].push(text);
    }
  }
  return states;
}

export function pseudoElementRules(element: Element, entries: RuleEntry[], pseudo: keyof PseudoRules): string[] {
  const rules: string[] = [];
  for (const entry of entries) {
    if (rules.length >= RULE_LIMITS.group) break;
    if (!entry.active) continue;
    const hit = entry.rule.selectorText.split(',').some(segment => {
      const trimmed = segment.trim();
      const match = trimmed.match(PSEUDO_ELEMENT);
      if (!match || match[1]!.toLowerCase() !== pseudo) return false;
      const base = trimmed.slice(0, match.index).trim();
      return !!base && base !== '*' && safeMatches(element, base);
    });
    if (!hit) continue;
    const declarations = declarationsOf(entry);
    if (declarations.length) rules.push(formatEntry(entry, declarations));
  }
  return rules;
}

export function inheritedDeclarations(style: CSSStyleDeclaration): string[] {
  const declarations: string[] = [];
  for (let index = 0; index < style.length; index++) {
    const property = style[index]!;
    if (!INHERITED_PROPERTIES.has(property)) continue;
    const priority = style.getPropertyPriority(property);
    declarations.push(`${property}: ${style.getPropertyValue(property).trim()}${priority ? ' !important' : ''}`);
  }
  return declarations;
}

export function inheritedRules(element: Element, entries: RuleEntry[]): string[] {
  const rules: string[] = [];
  for (let ancestor = element.parentElement; ancestor && rules.length < RULE_LIMITS.inherited; ancestor = ancestor.parentElement) {
    for (const entry of entries) {
      if (rules.length >= RULE_LIMITS.inherited) break;
      const selector = entry.rule.selectorText;
      if (!entry.active || isNoiseRule(selector) || !safeMatches(ancestor, selector)) continue;
      const declarations = inheritedDeclarations(entry.rule.style);
      if (!declarations.length) continue;
      const text = formatEntry(entry, declarations);
      if (!rules.includes(text)) rules.push(text);
    }
  }
  return rules;
}

export function referencedVariables(texts: string[], readValue: (name: string) => string): string[] {
  const names = new Set<string>();
  for (const text of texts) {
    for (const match of text.matchAll(/var\(\s*(--[\w-]+)/g)) names.add(match[1]!);
  }
  return [...names].slice(0, RULE_LIMITS.variables).map(name => {
    const value = readValue(name).trim();
    return `${name}: ${value || '(unset)'};`;
  });
}

export function collectRuleContext(
  element: Element,
  entries: RuleEntry[],
  view: Pick<Window, 'getComputedStyle'>,
): Omit<CssContext, 'resolved'> {
  const matched = matchedRules(element, entries);
  const inherited = inheritedRules(element, entries);
  const computed = view.getComputedStyle(element);
  const pseudos: PseudoRules = { before: [], after: [] };
  for (const pseudo of ['before', 'after'] as const) {
    let content = 'none';
    try {
      content = view.getComputedStyle(element, `::${pseudo}`).content;
    } catch { /* Pseudo-element styles are unavailable. */ }
    if (content && content !== 'none') pseudos[pseudo] = pseudoElementRules(element, entries, pseudo);
  }
  return {
    matched,
    media: otherBreakpointRules(element, entries),
    states: stateRules(element, entries, matched),
    inherited,
    pseudos,
    variables: referencedVariables([...matched, ...inherited], name => computed.getPropertyValue(name)),
  };
}
