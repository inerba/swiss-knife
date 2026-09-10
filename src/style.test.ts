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

it('strips the native fieldset groove that reads as a black rim', () => {
  expect(css).toMatch(/fieldset\s*\{[^}]*border:\s*0/s);
});

it('uses an outlined indigo brand mark in the panel', () => {
  expect(css).toMatch(/\.brand-icon\s*\{[^}]*background:\s*var\(--accent\)/s);
  expect(css).toMatch(/\.brand-icon\s*\{[^}]*color:\s*var\(--on-accent\)/s);
  expect(css).not.toMatch(/\.brand-icon\s*\{[^}]*background:\s*#a93728/s);
  expect(css).toMatch(/\.brand-icon svg\s*\{[^}]*fill:\s*none/s);
  expect(css).not.toMatch(/\.brand-icon path\s*\{[^}]*fill:\s*currentColor/s);
  expect(css).toMatch(/\.brand-icon svg\s*\{[^}]*transform:\s*rotate\(90deg\)/s);
});
