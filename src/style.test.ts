import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

const css = readFileSync('src/style.css', 'utf8');

it('defines panel tokens instead of mixing Canvas with inherited button color', () => {
  expect(css).toMatch(/--bg:/);
  expect(css).toMatch(/--fg:/);
  expect(css).toMatch(/--control:/);
  expect(css).toMatch(/--control-hover:/);
});

it('keeps button foreground on hover so icons stay readable', () => {
  expect(css).toMatch(/button\s*\{[^}]*color:\s*var\(--fg\)/s);
  expect(css).toMatch(/button:hover:not\(:disabled\)\s*\{[^}]*color:\s*var\(--fg\)/s);
  expect(css).toMatch(/button:hover:not\(:disabled\)\s*\{[^}]*background:\s*var\(--control-hover\)/s);
});

it('keeps the interface light regardless of system preference', () => {
  expect(css).toMatch(/color-scheme: light;/);
  expect(css).not.toMatch(/prefers-color-scheme|data-theme="dark"|light-dark\(/);
});

it('uses a high-contrast foreground for the emoji copy toast', () => {
  expect(css).toMatch(/\.emoji-copy-toast\s*\{[^}]*background:\s*color-mix\(in srgb, var\(--fg\) 88%, transparent\)[^}]*color:\s*var\(--on-accent\)/s);
});

it('grows emoji grid cells together with the selected preview size', () => {
  expect(css).toMatch(/\.emoji-grid\s*\{[^}]*minmax\(var\(--emoji-cell-size\), 1fr\)[^}]*gap:\s*6px/s);
  expect(css).toMatch(/\.emoji-preview-60\s*\{[^}]*--emoji-preview-size:\s*60px/s);
});
