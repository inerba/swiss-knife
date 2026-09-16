import { beforeEach, expect, it } from 'vitest';
import { scanStyleSheets } from './css-rules';
import {
  collectRuleContext,
  inheritedRules,
  matchedRules,
  otherBreakpointRules,
  referencedVariables,
  stateRules,
} from './css-match';

function setup(css: string, html: string) {
  document.head.innerHTML = '';
  const style = document.createElement('style');
  style.textContent = css;
  document.head.append(style);
  document.body.innerHTML = html;
  const { entries } = scanStyleSheets(
    [{ sheet: style.sheet as CSSStyleSheet, source: 'assets/app.css' }],
    { matchesMedia: query => query.includes('1px'), supports: () => true },
    'https://example.test/',
  );
  return { entries, element: document.querySelector('.card')! };
}

function fakeView(pseudoContent: Partial<Record<string, string>>, variables: Record<string, string> = {}) {
  return {
    getComputedStyle: (_element: Element, pseudo?: string | null) => ({
      content: pseudo ? pseudoContent[pseudo] ?? 'none' : 'normal',
      getPropertyValue: (name: string) => variables[name] ?? '',
    }),
  } as unknown as Pick<Window, 'getComputedStyle'>;
}

beforeEach(() => { document.body.innerHTML = ''; });

it('lists matching rules without resets and appends the inline style', () => {
  const { entries, element } = setup(
    '* { box-sizing: border-box } a, abbr, b, span { margin: 0 } .card { padding: 24px; border-radius: var(--radius) } @media (min-width: 1px) { .card { gap: 4px } } .other { color: red }',
    '<div class="card" style="top: 1px">x</div>',
  );
  expect(matchedRules(element, entries)).toEqual([
    '/* assets/app.css */\n.card { padding: 24px;\n  border-radius: var(--radius); }',
    '/* assets/app.css */\n@media (min-width: 1px) { .card { gap: 4px; } }',
    'element.style { top: 1px; }',
  ]);
});

it('lists rules for inactive breakpoints separately', () => {
  const { entries, element } = setup('@media (min-width: 900px) { .card { margin: 0 } }', '<div class="card"></div>');
  expect(matchedRules(element, entries)).toEqual([]);
  expect(otherBreakpointRules(element, entries)).toEqual(['/* assets/app.css */\n@media (min-width: 900px) { .card { margin: 0; } }']);
});

it('groups interaction states and skips rules already matched', () => {
  const { entries, element } = setup(
    '.card:hover { color: blue } .card:focus-visible { outline: 2px solid } .other:active { color: red }',
    '<div class="card"></div>',
  );
  expect(stateRules(element, entries, [])).toEqual({
    hover: ['/* assets/app.css */\n.card:hover { color: blue; }'],
    focus: ['/* assets/app.css */\n.card:focus-visible { outline: 2px solid; }'],
    active: [],
  });
  const hover = '/* assets/app.css */\n.card:hover { color: blue; }';
  expect(stateRules(element, entries, [hover]).hover).toEqual([]);
});

it('keeps only inheritable declarations from ancestors', () => {
  const { entries, element } = setup('body { color: red; margin: 0 } .card { color: blue }', '<div class="card"></div>');
  expect(inheritedRules(element, entries)).toEqual(['/* assets/app.css */\nbody { color: red; }']);
});

it('collects pseudo-elements only when rendered and skips universal ones', () => {
  const { entries, element } = setup(
    '.card::before { content: "x" } *::before { box-sizing: inherit } .card::after { content: "y" }',
    '<div class="card"></div>',
  );
  const context = collectRuleContext(element, entries, fakeView({ '::before': '"x"' }));
  expect(context.pseudos).toEqual({
    before: ['/* assets/app.css */\n.card::before { content: "x"; }'],
    after: [],
  });
});

it('resolves the variables referenced by matched and inherited rules', () => {
  const { entries, element } = setup('.card { padding: var(--space); gap: var( --gap, 1px) }', '<div class="card"></div>');
  const context = collectRuleContext(element, entries, fakeView({}, { '--space': ' 24px' }));
  expect(context.variables).toEqual(['--space: 24px;', '--gap: (unset);']);
  expect(referencedVariables(['a { b: var(--x) }', 'c { d: var(--x) }'], () => '1px')).toEqual(['--x: 1px;']);
});
