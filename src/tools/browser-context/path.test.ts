import { beforeEach, expect, it } from 'vitest';
import { selectorPath, selectorSegment } from './path';

beforeEach(() => { document.body.innerHTML = ''; });

it('prefers the id', () => {
  document.body.innerHTML = '<main id="app" class="shell"></main>';
  expect(selectorSegment(document.querySelector('main')!)).toBe('main#app');
});

it('keeps up to three classes and skips state and overlay classes', () => {
  document.body.innerHTML = '<div class="active card swiss-inspector-outline card--featured hover wide tall"></div>';
  expect(selectorSegment(document.querySelector('div')!)).toBe('div.card.card--featured.wide');
});

it('uses nth-of-type only when siblings share the tag', () => {
  document.body.innerHTML = '<ul><li></li><li></li></ul><p><span></span></p>';
  expect(selectorSegment(document.querySelectorAll('li')[1]!)).toBe('li:nth-of-type(2)');
  expect(selectorSegment(document.querySelector('span')!)).toBe('span');
});

it('builds the path up to the nearest id', () => {
  document.body.innerHTML = '<main id="app"><section class="pricing"><div class="card"></div></section></main>';
  expect(selectorPath(document.querySelector('.card')!)).toBe('main#app > section.pricing > div.card');
});

it('limits the path to eight segments', () => {
  document.body.innerHTML = '<div><div><div><div><div><div><div><div><div><b></b></div></div></div></div></div></div></div></div></div>';
  expect(selectorPath(document.querySelector('b')!).split(' > ')).toHaveLength(8);
});
