import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

const css = readFileSync('src/tools/emoji/emoji.css', 'utf8');

it('uses a pill segmented control and 16px cards from the design spec', () => {
  expect(css).toMatch(/\.emoji-categories\s*\{[^}]*border-radius:\s*999px/s);
  expect(css).toMatch(/\.emoji-categories\s*\{[^}]*background:\s*rgba\(0, 0, 0, \.05\)/s);
  expect(css).toMatch(/\.emoji-skins > div\s*\{[^}]*border-radius:\s*999px/s);
  expect(css).not.toMatch(/\.emoji-categories button\[aria-pressed="true"\][^}]*background:\s*var\(--ios-accent-soft\)/s);
  expect(css).toMatch(/\.emoji-categories button\[aria-pressed="true"\][^}]*background:\s*#ffffff/s);
  expect(css).toMatch(/\.emoji-results\s*\{[^}]*border-radius:\s*var\(--ios-card-radius\)/s);
  expect(css).toMatch(/\.emoji-size-options button\s*\{[^}]*border-radius:\s*var\(--ios-card-radius\)/s);
});

it('uses inspector inputs and fluid 150ms motion from the design spec', () => {
  expect(css).toMatch(/\.emoji-search-field\s*\{[^}]*border-radius:\s*7px/s);
  expect(css).toMatch(/\.emoji-search-field\s*\{[^}]*min-height:\s*28px/s);
  expect(css).toMatch(/\.emoji-search-field:focus-within\s*\{[^}]*box-shadow:\s*0 0 0 3px var\(--ios-accent-glow\)/s);
  expect(css).toMatch(/\.15s var\(--ease-fluid\)/);
});

it('grows emoji grid cells together with the selected preview size', () => {
  expect(css).toMatch(/\.emoji-grid\s*\{[^}]*minmax\(var\(--emoji-cell-size\), 1fr\)[^}]*gap:\s*6px/s);
  expect(css).toMatch(/\.emoji-preview-60\s*\{[^}]*--emoji-preview-size:\s*60px/s);
});

it('uses a glass pill toast instead of a dark overlay', () => {
  expect(css).toMatch(/\.emoji-copy-toast\s*\{[^}]*border-radius:\s*999px/s);
  expect(css).toMatch(/\.emoji-copy-toast\s*\{[^}]*backdrop-filter:\s*saturate\(180%\) blur\(20px\)/s);
  expect(css).not.toMatch(/color-mix\(in srgb, var\(--fg\) 88%/);
});
