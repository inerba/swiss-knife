import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

const css = readFileSync('src/tools/inspect-save/inspect-save.css', 'utf8');

it('keeps the preview png inside the panel', () => {
  expect(css).toMatch(/\.inspect-preview-box\s*\{[^}]*overflow:\s*hidden/s);
  expect(css).toMatch(/\.inspect-preview-box img\s*\{[^}]*max-width:\s*100%/s);
  expect(css).toMatch(/\.inspect-preview-box img\s*\{[^}]*object-fit:\s*contain/s);
  expect(css).toMatch(/\.inspect-preview-box img\s*\{[^}]*min-width:\s*0/s);
});

it('wraps long selectors and property values', () => {
  expect(css).toMatch(/\.inspect-pill\s*\{[^}]*overflow-wrap:\s*anywhere/s);
  expect(css).toMatch(/\.inspect-row b,\s*\n\.inspect-row code\s*\{[^}]*overflow-wrap:\s*anywhere/s);
  expect(css).toMatch(/\.inspect-row b,\s*\n\.inspect-row code\s*\{[^}]*word-break:\s*break-word/s);
});
