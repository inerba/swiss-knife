import { expect, it } from 'vitest';
import { MARKUP_LIMIT, cleanMarkup, formatKilobytes, shortenDataUri, truncateMarkup } from './markup';

function element(html: string) {
  const template = document.createElement('template');
  template.innerHTML = html;
  return template.content.firstElementChild!;
}

it('removes swiss knife attributes and the outline class', () => {
  const html = cleanMarkup(element('<div class="swiss-inspector-outline" data-swiss-inspect=""><span class="a swiss-inspector-outline">x</span></div>'));
  expect(html).toBe('<div><span class="a">x</span></div>');
});

it('shortens long data uris', () => {
  const src = `data:image/png;base64,${'A'.repeat(4000)}`;
  expect(cleanMarkup(element(`<img src="${src}">`))).toBe('<img src="data:image/png;base64,…(3 KB)">');
  expect(shortenDataUri(`data:text/plain,${'a'.repeat(3000)}`)).toBe('data:text/plain,…(3 KB)');
});

it('keeps short data uris and other attributes', () => {
  expect(shortenDataUri('data:image/gif;base64,R0lGOD')).toBe('data:image/gif;base64,R0lGOD');
  expect(cleanMarkup(element('<a href="/pricing" title="Prezzi">x</a>'))).toBe('<a href="/pricing" title="Prezzi">x</a>');
});

it('shortens long svg path data', () => {
  const d = `M0 0 ${'L10 10 '.repeat(50)}`;
  const html = cleanMarkup(element(`<svg><path d="${d}"></path></svg>`));
  expect(html).toContain(`d="${d.slice(0, 60)}…"`);
});

it('truncates markup above the limit', () => {
  const result = truncateMarkup('x'.repeat(MARKUP_LIMIT + 10));
  expect(result).toBe(`${'x'.repeat(MARKUP_LIMIT)}\n<!-- truncated: element markup exceeds 60 KB -->`);
  expect(truncateMarkup('<b></b>')).toBe('<b></b>');
});

it('formats kilobytes with a minimum of 1', () => {
  expect(formatKilobytes(10)).toBe('1 KB');
  expect(formatKilobytes(14_500)).toBe('14 KB');
});
