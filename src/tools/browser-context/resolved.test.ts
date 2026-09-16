import { expect, it } from 'vitest';
import { RESOLVED_LIMIT, diffComputed, readResolvedValues } from './resolved';

const values = (entries: Record<string, string>) => new Map(Object.entries(entries));

it('keeps only properties that differ from the baseline', () => {
  const computed = values({ display: 'flex', color: 'rgb(0, 0, 0)', 'z-index': '2' });
  const baseline = values({ display: 'block', color: 'rgb(0, 0, 0)', 'z-index': 'auto' });
  expect(diffComputed(computed, baseline, new Map())).toEqual(['display: flex;', 'z-index: 2;']);
});

it('drops vendor, logical and mirrored colour properties', () => {
  const computed = values({
    '-webkit-locale': 'it',
    'inline-size': '10px',
    'margin-inline-start': '4px',
    'inset-block-start': '1px',
    color: 'rgb(255, 0, 0)',
    'caret-color': 'rgb(255, 0, 0)',
    'text-decoration-color': 'rgb(0, 0, 255)',
  });
  expect(diffComputed(computed, new Map(), new Map())).toEqual([
    'color: rgb(255, 0, 0);',
    'text-decoration-color: rgb(0, 0, 255);',
  ]);
});

it('drops border and outline colours that only follow the text colour', () => {
  const computed = values({
    color: 'rgb(20, 20, 20)',
    'border-top-color': 'rgb(20, 20, 20)',
    'border-right-color': 'rgb(20, 20, 20)',
    'border-bottom-color': 'rgb(20, 20, 20)',
    'border-left-color': 'rgb(20, 20, 20)',
    'border-block-start-color': 'rgb(0, 0, 255)',
    'border-inline-end-width': '3px',
    'outline-color': 'rgb(255, 0, 0)',
  });
  expect(diffComputed(computed, new Map(), values({ border: '0px none rgb(20, 20, 20)' }))).toEqual([
    'color: rgb(20, 20, 20);',
    'outline-color: rgb(255, 0, 0);',
  ]);
});

it('drops context-only sizing, row rules and text size adjustments', () => {
  const computed = values({
    color: 'rgb(20, 20, 20)',
    'min-width': 'auto',
    'min-height': 'auto',
    'row-rule-color': 'rgb(20, 20, 20)',
    'text-size-adjust': '100%',
    'max-width': '512px',
  });
  const baseline = values({ 'min-width': '0px', 'min-height': '0px', 'max-width': 'none' });
  expect(diffComputed(computed, baseline, new Map())).toEqual(['color: rgb(20, 20, 20);', 'max-width: 512px;']);
});

it('folds longhands into their computed shorthand', () => {
  const computed = values({ 'margin-top': '8px', 'margin-bottom': '8px', 'border-top-left-radius': '4px', 'padding-left': '2px' });
  const shorthands = values({ margin: '8px 0px', 'border-radius': '4px 0px 0px', padding: '' });
  expect(diffComputed(computed, new Map(), shorthands)).toEqual([
    'margin: 8px 0px;',
    'border-radius: 4px 0px 0px;',
    'padding-left: 2px;',
  ]);
});

it('caps the list', () => {
  const computed = new Map(Array.from({ length: 250 }, (_, index) => [`p-${String(index).padStart(3, '0')}`, '1']));
  expect(diffComputed(computed, new Map(), new Map())).toHaveLength(RESOLVED_LIMIT);
});

it('reads values through a temporary iframe and removes it', () => {
  const element = document.createElement('div');
  document.body.append(element);
  const result = readResolvedValues(element, window);
  expect(Array.isArray(result)).toBe(true);
  expect(document.querySelector('iframe[data-swiss-inspect]')).toBeNull();
});
