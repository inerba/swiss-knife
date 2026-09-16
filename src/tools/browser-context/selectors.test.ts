import { beforeEach, expect, it } from 'vitest';
import {
  countCss,
  countXPath,
  cssFull,
  cssShort,
  isStableToken,
  xpathAbsolute,
  xpathLiteral,
  xpathRelative,
  xpathText,
} from './selectors';

beforeEach(() => { document.body.innerHTML = ''; });

function pick(selector: string) {
  return document.querySelector(selector)!;
}

it('recognises generated ids and classes', () => {
  expect(isStableToken('fi-main-content')).toBe(true);
  expect(isStableToken('form.email')).toBe(true);
  expect(isStableToken('card--featured')).toBe(true);
  expect(isStableToken('css-1x9ab')).toBe(false);
  expect(isStableToken('sc-bdfBwQ')).toBe(false);
  expect(isStableToken('ember1234')).toBe(false);
  expect(isStableToken('4WSWJI0hwB1gq2Ukv6xC')).toBe(false);
  expect(isStableToken(':r1:')).toBe(false);
  expect(isStableToken('hover:bg-red-500')).toBe(false);
  expect(isStableToken('w-[12px]')).toBe(false);
  expect(isStableToken('')).toBe(false);
});

it('quotes xpath literals safely', () => {
  expect(xpathLiteral('Accedi')).toBe("'Accedi'");
  expect(xpathLiteral("l'utente")).toBe('"l\'utente"');
  expect(xpathLiteral(`a'b"c`)).toBe(`concat('a', "'", 'b"c')`);
});

it('prefers a stable id for the short css selector', () => {
  document.body.innerHTML = '<main id="fi-main-content" class="fi-simple-main"></main><main class="fi-simple-main"></main>';
  expect(cssShort(pick('#fi-main-content'))).toBe('#fi-main-content');
});

it('escapes ids with special characters', () => {
  document.body.innerHTML = '<input id="form.email">';
  const selector = cssShort(pick('input'));
  expect(countCss(document, selector)).toBe(1);
  expect(document.querySelector(selector)).toBe(pick('input'));
});

it('uses test attributes, name and classes before falling back', () => {
  document.body.innerHTML = [
    '<button data-testid="save" class="btn">Salva</button>',
    '<input name="email"><input name="password">',
    '<div class="card"></div><div class="card featured"></div>',
  ].join('');
  expect(cssShort(pick('button'))).toBe('[data-testid="save"]');
  expect(cssShort(pick('input[name="password"]'))).toBe('input[name="password"]');
  expect(cssShort(pick('.featured'))).toBe('div.featured');
});

it('anchors to a unique ancestor when the element alone is ambiguous', () => {
  document.body.innerHTML = '<ul id="menu"><li><a class="link">A</a></li><li><a class="link">B</a></li></ul><a class="link">C</a>';
  const second = document.querySelectorAll('#menu a')[1]!;
  const selector = cssShort(second);
  expect(countCss(document, selector)).toBe(1);
  expect(document.querySelector(selector)).toBe(second);
  expect(selector.startsWith('#menu')).toBe(true);
});

it('builds a full css path that always matches only the element', () => {
  document.body.innerHTML = '<div><p>a</p><p>b</p></div><div><p>c</p></div>';
  const target = document.querySelectorAll('p')[1]!;
  const selector = cssFull(target);
  expect(selector).toBe('html > body > div:nth-of-type(1) > p:nth-of-type(2)');
  expect(document.querySelectorAll(selector)).toHaveLength(1);
  expect(document.querySelector(selector)).toBe(target);
});

it('builds absolute xpaths with indexes only where siblings share the tag', () => {
  document.body.innerHTML = '<div><span></span><p>a</p><p>b</p></div><div><main></main></div>';
  expect(xpathAbsolute(document.querySelectorAll('p')[1]!)).toBe('/html/body/div[1]/p[2]');
  expect(xpathAbsolute(pick('main'))).toBe('/html/body/div[2]/main');
  expect(xpathAbsolute(pick('span'))).toBe('/html/body/div[1]/span');
});

it('uses local-name for svg elements', () => {
  document.body.innerHTML = '<button><svg><path d="M0 0"></path></svg></button>';
  const expression = xpathAbsolute(pick('path'));
  expect(expression).toBe("/html/body/button/*[local-name()='svg']/*[local-name()='path']");
  // jsdom's XPath engine cannot evaluate local-name(); the real-browser check covers the match count.
});

it('builds relative xpaths from attributes or an anchored ancestor', () => {
  document.body.innerHTML = [
    '<main id="fi-main-content"></main>',
    '<div id="app"><section><p>a</p><p>b</p></section></div>',
    '<p>c</p>',
  ].join('');
  expect(xpathRelative(pick('main'))).toBe("//main[@id='fi-main-content']");
  const second = document.querySelectorAll('#app p')[1]!;
  const expression = xpathRelative(second);
  expect(expression).toBe("//div[@id='app']/section/p[2]");
  expect(countXPath(document, expression)).toBe(1);
});

it('builds text xpaths only for short text', () => {
  document.body.innerHTML = `<button>  Accedi  </button><p>${'lungo '.repeat(20)}</p><div></div>`;
  expect(xpathText(pick('button'))).toBe("//button[normalize-space()='Accedi']");
  expect(xpathText(pick('p'))).toBeNull();
  expect(xpathText(pick('div'))).toBeNull();
});

it('counts matches and treats invalid expressions as zero', () => {
  document.body.innerHTML = '<p></p><p></p>';
  expect(countCss(document, 'p')).toBe(2);
  expect(countCss(document, 'p[')).toBe(0);
  expect(countXPath(document, '//p')).toBe(2);
  expect(countXPath(document, '//p[')).toBe(0);
});
