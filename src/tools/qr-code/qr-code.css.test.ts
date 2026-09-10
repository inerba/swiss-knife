import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

const css = readFileSync('src/tools/qr-code/qr-code.css', 'utf8');

it('reuses the shared image-preview checkerboard for the QR stage', () => {
  expect(css).toMatch(/\.qr-preview\s*\{[^}]*padding:\s*16px/s);
  expect(css).toMatch(/\.qr-preview\s*\{[^}]*border-radius:\s*var\(--ios-card-radius\)/s);
  expect(css).not.toMatch(/\.qr-preview\s*\{[^}]*background:\s*#fff/s);
  expect(css).not.toMatch(/\.qr-preview-board/);
});

it('inherits panel field fills instead of painting white controls', () => {
  expect(css).not.toMatch(/\.qr-tool input[^}]*background:\s*var\(--control\)/s);
  expect(css).not.toMatch(/\.qr-tool textarea[^}]*background:\s*var\(--control\)/s);
});

it('uses a pill segmented control and 16px cards from the design spec', () => {
  expect(css).toMatch(/\.qr-tabs\s*\{[^}]*border-radius:\s*999px/s);
  expect(css).not.toMatch(/\.qr-tabs button\[aria-selected="true"\]\s*\{[^}]*background:\s*var\(--accent\)/s);
  expect(css).toMatch(/\.qr-style-card\s*\{[^}]*border-radius:\s*var\(--ios-card-radius\)/s);
  expect(css).toMatch(/\.qr-export-actions\s*\{[^}]*border-radius:\s*999px/s);
});
