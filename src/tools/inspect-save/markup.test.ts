import { describe, expect, it } from 'vitest';
import { buildMarkupFromHtml, buildMarkupSnippet, sanitizeMarkup } from './markup';

describe('sanitizeMarkup', () => {
  it('removes inline event handlers', () => {
    const html = '<button onclick="alert(1)" class="x">Ok</button>';
    expect(sanitizeMarkup(html)).not.toContain('onclick');
  });

  it('removes javascript hrefs', () => {
    const html = '<a href="javascript:alert(1)">link</a>';
    expect(sanitizeMarkup(html)).not.toContain('javascript:');
  });
});

describe('buildMarkupFromHtml', () => {
  it('wraps css and html together', () => {
    const snippet = buildMarkupFromHtml('<div class="a">Hi</div>', '.a { color: red; }');
    expect(snippet).toContain('<style>');
    expect(snippet).toContain('.a { color: red; }');
    expect(snippet).toContain('<div class="a">Hi</div>');
  });
});

describe('buildMarkupSnippet', () => {
  it('exports subtree with scoped css', () => {
    document.body.innerHTML = '<div id="root" class="card" style="padding:12px"><span>T</span></div>';
    const root = document.getElementById('root')!;
    const snippet = buildMarkupSnippet(root);
    expect(snippet).toContain('<style>');
    expect(snippet).toContain('swiss-export-');
    expect(snippet).toContain('swiss-export-span-1');
    expect(snippet).not.toContain('<script');
  });
});
