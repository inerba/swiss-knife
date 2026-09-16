export const OVERLAY_ATTR = 'data-swiss-inspect';

const STYLE_RULE = 1;
const IMPORT_RULE = 3;
const MEDIA_RULE = 4;
const SUPPORTS_RULE = 12;

export interface RuleEntry {
  rule: CSSStyleRule;
  source: string;
  wrappers: string[];
  active: boolean;
}

export interface SourcedSheet {
  sheet: CSSStyleSheet;
  source: string;
}

export interface ScanEnvironment {
  matchesMedia(query: string): boolean;
  supports(condition: string): boolean;
}

export interface SheetScan {
  entries: RuleEntry[];
  unreadable: string[];
}

// Split "a: b; c: d" on semicolons outside quotes and parentheses:
// values like url(data:…;base64,…) contain literal semicolons.
export function splitDeclarations(text: string): string[] {
  const declarations: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let start = 0;
  for (let index = 0; index < text.length; index++) {
    const character = text[index];
    if (quote) {
      if (character === quote && text[index - 1] !== '\\') quote = null;
    } else if (character === '"' || character === "'") {
      quote = character;
    } else if (character === '(') {
      depth++;
    } else if (character === ')') {
      depth = Math.max(0, depth - 1);
    } else if (character === ';' && depth === 0) {
      const declaration = text.slice(start, index).trim();
      if (declaration) declarations.push(declaration);
      start = index + 1;
    }
  }
  const tail = text.slice(start).trim();
  if (tail) declarations.push(tail);
  return declarations;
}

export function formatRule(selector: string, declarations: string[]): string {
  return `${selector} { ${declarations.join(';\n  ')}${declarations.length ? ';' : ''} }`;
}

// Universal rules and tag-soup resets match every element and say nothing
// about the selected one. A single bare tag selector is real styling.
export function isNoiseRule(selectorText: string): boolean {
  const segments = selectorText.split(',').map(segment => segment.trim());
  const generic = segments.every(segment => /^(\*|::?[a-z-]+|[a-z][a-z0-9-]*)$/i.test(segment));
  return generic && (segments.length > 3 || segments.includes('*'));
}

export function atRuleHeader(cssText: string): string {
  const brace = cssText.indexOf('{');
  return (brace < 0 ? cssText : cssText.slice(0, brace)).trim();
}

export function wrapRule(ruleText: string, wrappers: string[]): string {
  return wrappers.reduceRight((inner, wrapper) => `${wrapper} { ${inner} }`, ruleText);
}

export function formatEntry(entry: RuleEntry, declarations: string[]): string {
  return `/* ${entry.source} */\n${wrapRule(formatRule(entry.rule.selectorText, declarations), entry.wrappers)}`;
}

export function sourceLabel(href: string | null | undefined, pageUrl: string, styleIndex: number): string {
  if (href) {
    try {
      const url = new URL(href, pageUrl);
      return url.host === new URL(pageUrl).host ? url.pathname : `${url.host}${url.pathname}`;
    } catch {
      return href;
    }
  }
  return styleIndex > 0 ? `<style> #${styleIndex}` : '<style>';
}

function hostOf(href: string, pageUrl: string) {
  try {
    return new URL(href, pageUrl).host || href;
  } catch {
    return href;
  }
}

export function listSheets(doc: Document): SourcedSheet[] {
  const pageUrl = doc.location?.href ?? '';
  const styles = [...doc.querySelectorAll('style')].filter(node => !node.hasAttribute(OVERLAY_ATTR));
  const list: SourcedSheet[] = [];
  for (const sheet of [...doc.styleSheets]) {
    const owner = sheet.ownerNode as Element | null | undefined;
    if (owner && typeof owner.hasAttribute === 'function' && owner.hasAttribute(OVERLAY_ATTR)) continue;
    const index = owner ? styles.indexOf(owner as HTMLStyleElement) + 1 : 0;
    list.push({ sheet, source: sourceLabel(sheet.href, pageUrl, index) });
  }
  const adopted = (doc as Document & { adoptedStyleSheets?: CSSStyleSheet[] }).adoptedStyleSheets ?? [];
  adopted.forEach((sheet, index) => list.push({ sheet, source: `adopted stylesheet #${index + 1}` }));
  return list;
}

export function scanStyleSheets(sheets: SourcedSheet[], env: ScanEnvironment, pageUrl: string): SheetScan {
  const entries: RuleEntry[] = [];
  const unreadable = new Set<string>();

  function readSheet(sheet: CSSStyleSheet, source: string, wrappers: string[], active: boolean) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      unreadable.add(sheet.href ? hostOf(sheet.href, pageUrl) : source);
      return;
    }
    visit(rules, source, wrappers, active);
  }

  function visit(rules: CSSRuleList, source: string, wrappers: string[], active: boolean) {
    for (const rule of Array.from(rules)) {
      try {
        if (rule.type === STYLE_RULE) {
          entries.push({ rule: rule as CSSStyleRule, source, wrappers, active });
        } else if (rule.type === IMPORT_RULE) {
          const imported = (rule as CSSImportRule).styleSheet;
          if (imported) readSheet(imported, sourceLabel(imported.href, pageUrl, 0), wrappers, active);
        } else if (rule.type === MEDIA_RULE) {
          const media = rule as CSSMediaRule;
          const query = media.media.mediaText;
          visit(media.cssRules, source, [...wrappers, `@media ${query}`], active && env.matchesMedia(query));
        } else if ('cssRules' in rule) {
          const group = rule as CSSGroupingRule;
          const header = atRuleHeader(rule.cssText);
          if (rule.type === SUPPORTS_RULE || header.startsWith('@supports')) {
            const condition = (rule as CSSSupportsRule).conditionText ?? header.replace(/^@supports\s*/i, '');
            if (env.supports(condition)) visit(group.cssRules, source, [...wrappers, header], active);
          } else if (header.startsWith('@container')) {
            visit(group.cssRules, source, [...wrappers, `${header} /* container condition not evaluated */`], active);
          } else if (header.startsWith('@layer')) {
            visit(group.cssRules, source, [...wrappers, header], active);
          } else {
            visit(group.cssRules, source, wrappers, active);
          }
        }
      } catch {
        // Unsupported rule type or unreadable nested sheet.
      }
    }
  }

  for (const { sheet, source } of sheets) readSheet(sheet, source, [], true);
  return { entries, unreadable: [...unreadable] };
}
