import { expect, it } from 'vitest';
import {
  formatEntry,
  formatRule,
  isNoiseRule,
  listSheets,
  scanStyleSheets,
  sourceLabel,
  splitDeclarations,
  wrapRule,
  type RuleEntry,
} from './css-rules';

function sheetFrom(css: string) {
  const style = document.createElement('style');
  style.textContent = css;
  document.head.append(style);
  return style.sheet as CSSStyleSheet;
}

it('splits declarations outside quotes and parentheses', () => {
  expect(splitDeclarations('color: red; background: url(data:image/png;base64,AA;BB); content: "a;b";')).toEqual([
    'color: red',
    'background: url(data:image/png;base64,AA;BB)',
    'content: "a;b"',
  ]);
});

it('formats a rule like devtools', () => {
  expect(formatRule('.a', ['color: red', 'margin: 0'])).toBe('.a { color: red;\n  margin: 0; }');
});

it('filters universal and tag-soup resets only', () => {
  expect(isNoiseRule('*')).toBe(true);
  expect(isNoiseRule('a, abbr, b, span')).toBe(true);
  expect(isNoiseRule('html, *')).toBe(true);
  expect(isNoiseRule('h1')).toBe(false);
  expect(isNoiseRule('html, body')).toBe(false);
  expect(isNoiseRule('.card')).toBe(false);
});

it('labels rule sources', () => {
  expect(sourceLabel('https://example.test/assets/app.css', 'https://example.test/pricing', 0)).toBe('/assets/app.css');
  expect(sourceLabel('https://cdn.example.net/ui.css', 'https://example.test/', 0)).toBe('cdn.example.net/ui.css');
  expect(sourceLabel(null, 'https://example.test/', 3)).toBe('<style> #3');
  expect(sourceLabel(undefined, 'https://example.test/', 0)).toBe('<style>');
});

it('wraps rules in their at-rules and prefixes the source', () => {
  expect(wrapRule('.a { color: red; }', ['@media (min-width: 1px)', '@layer base']))
    .toBe('@media (min-width: 1px) { @layer base { .a { color: red; } } }');
  const entry = { rule: { selectorText: '.a' }, source: 'app.css', wrappers: ['@layer base'], active: true } as unknown as RuleEntry;
  expect(formatEntry(entry, ['color: red'])).toBe('/* app.css */\n@layer base { .a { color: red; } }');
});

it('scans style rules with at-rule context', () => {
  const sheet = sheetFrom([
    '.a { color: red }',
    '@media (min-width: 900px) { .a { margin: 0 } }',
    '@supports (display:grid) { .a { display: grid } }',
    '@supports (foo:bar) { .a { gap: 1px } }',
    '@layer base { .a { padding: 1px } }',
    '@container (min-width: 1px) { .a { gap: 2px } }',
  ].join('\n'));
  const scan = scanStyleSheets(
    [{ sheet, source: 'app.css' }],
    { matchesMedia: () => false, supports: condition => condition.includes('grid') },
    'https://example.test/',
  );
  expect(scan.unreadable).toEqual([]);
  expect(scan.entries.map(entry => ({ selector: entry.rule.selectorText, wrappers: entry.wrappers, active: entry.active, source: entry.source }))).toEqual([
    { selector: '.a', wrappers: [], active: true, source: 'app.css' },
    { selector: '.a', wrappers: ['@media (min-width: 900px)'], active: false, source: 'app.css' },
    { selector: '.a', wrappers: ['@supports (display:grid)'], active: true, source: 'app.css' },
    { selector: '.a', wrappers: ['@layer base'], active: true, source: 'app.css' },
    { selector: '.a', wrappers: ['@container (min-width: 1px) /* container condition not evaluated */'], active: true, source: 'app.css' },
  ]);
});

it('records unreadable cross-origin sheets by host', () => {
  const blocked = {
    href: 'https://fonts.example.com/css?family=Inter',
    get cssRules(): CSSRuleList { throw new Error('SecurityError'); },
  } as unknown as CSSStyleSheet;
  const scan = scanStyleSheets(
    [{ sheet: blocked, source: 'fonts.example.com/css' }, { sheet: blocked, source: 'fonts.example.com/css' }],
    { matchesMedia: () => true, supports: () => true },
    'https://example.test/',
  );
  expect(scan.unreadable).toEqual(['fonts.example.com']);
  expect(scan.entries).toEqual([]);
});

it('lists document sheets with sources and skips the overlay', () => {
  const style = document.createElement('style');
  const overlay = document.createElement('style');
  overlay.setAttribute('data-swiss-inspect', '');
  const link = document.createElement('link');
  const fakeDocument = {
    location: { href: 'https://example.test/pricing' },
    querySelectorAll: () => [style, overlay],
    styleSheets: [
      { href: null, ownerNode: style },
      { href: 'https://example.test/assets/app.css', ownerNode: link },
      { href: null, ownerNode: overlay },
    ],
    adoptedStyleSheets: [{ href: null }],
  } as unknown as Document;
  expect(listSheets(fakeDocument).map(item => item.source)).toEqual([
    '<style> #1',
    '/assets/app.css',
    'adopted stylesheet #1',
  ]);
});
