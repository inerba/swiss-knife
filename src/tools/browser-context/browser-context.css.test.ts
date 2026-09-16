import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

const css = readFileSync('src/tools/browser-context/browser-context.css', 'utf8');

it('keeps the preview png inside the panel', () => {
  expect(css).toMatch(/\.context-preview-box\s*\{[^}]*overflow:\s*hidden/s);
  expect(css).toMatch(/\.context-preview-box img\s*\{[^}]*max-width:\s*100%/s);
  expect(css).toMatch(/\.context-preview-box img\s*\{[^}]*object-fit:\s*contain/s);
});

it('wraps long selectors and the report preview', () => {
  expect(css).toMatch(/\.context-pill\s*\{[^}]*overflow-wrap:\s*anywhere/s);
  expect(css).toMatch(/\.context-report pre\s*\{[^}]*white-space:\s*pre-wrap/s);
  expect(css).toMatch(/\.context-report pre\s*\{[^}]*overflow-wrap:\s*anywhere/s);
});

it('does not inherit control colours', () => {
  expect(css).not.toMatch(/color:\s*inherit/);
});

it('wraps long selectors and makes them easy to select', () => {
  expect(css).toMatch(/\.context-selector-body code\s*\{[^}]*overflow-wrap:\s*anywhere/s);
  expect(css).toMatch(/\.context-selector-body code\s*\{[^}]*user-select:\s*all/s);
});
