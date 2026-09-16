import { beforeEach, expect, it } from 'vitest';
import { selectorPath, selectorSegment } from './path';

beforeEach(() => { document.body.innerHTML = ''; });

it('keeps the id and the classes', () => {
  document.body.innerHTML = '<main id="fi-main-content" class="fi-simple-main fi-width-lg"></main>';
  expect(selectorSegment(document.querySelector('main')!)).toBe('main#fi-main-content.fi-simple-main.fi-width-lg');
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

it('includes ancestors when the element itself has an id', () => {
  document.body.innerHTML = '<div class="fi-simple-layout"><div class="fi-simple-main-ctn"><main id="fi-main-content" class="fi-simple-main"></main></div></div>';
  expect(selectorPath(document.querySelector('main')!)).toBe('body > div.fi-simple-layout > div.fi-simple-main-ctn > main#fi-main-content.fi-simple-main');
});

it('stops at the nearest ancestor with an id', () => {
  document.body.innerHTML = '<div id="app" class="root"><section><p id="lead">x</p></section></div>';
  expect(selectorPath(document.querySelector('p')!)).toBe('div#app.root > section > p#lead');
});
