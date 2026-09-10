import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

const css = readFileSync('src/tools/password-generator/password-generator.css', 'utf8');

it('uses a QR-style disclosure card, 42px success toggles on the right, and inspector symbol input', () => {
  expect(css).toMatch(/\.pw-style-card\s*\{[^}]*border-radius:\s*var\(--ios-card-radius\)/s);
  expect(css).toMatch(/\.pw-style-card\s*\{[^}]*border:\s*none/s);
  expect(css).not.toMatch(/\.pw-style-card\s*\{[^}]*border:\s*1px solid/s);
  expect(css).toMatch(/\.pw-acc summary\s*\{[^}]*font-size:\s*11px/s);
  expect(css).toMatch(/\.pw-acc summary\s*\{[^}]*font-weight:\s*700/s);
  expect(css).toMatch(/\.pw-acc summary\s*\{[^}]*letter-spacing:\s*\.04em/s);
  expect(css).toMatch(/\.pw-row\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) auto/s);
  expect(css).toMatch(/\.pw-toggle\s*\{[^}]*width:\s*42px/s);
  expect(css).toMatch(/\.pw-toggle\s*\{[^}]*height:\s*26px/s);
  expect(css).toMatch(/\.pw-toggle:checked::before\s*\{[^}]*translateX\(16px\)/s);
  expect(css).toMatch(/\.pw-toggle:checked\s*\{[^}]*background:\s*var\(--state-success\)/s);
  expect(css).not.toMatch(/grid-row:\s*1\s*\/\s*span 2/);
  expect(css).toMatch(/#pw-symbols-set\s*\{[^}]*font-family:\s*var\(--font-mono\)/s);
  expect(css).toMatch(/#pw-symbols-set\s*\{[^}]*min-height:\s*28px/s);
  expect(css).not.toMatch(/\.pw-toggle:checked\s*\{[^}]*background:\s*var\(--accent\)/s);
  expect(css).not.toMatch(/\.pw-list\s*\{[^}]*box-shadow:\s*var\(--shadow-card\)/s);
});
