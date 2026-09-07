import { expect, it } from 'vitest';
import { applyAppearance } from './appearance';
it('replaces a legacy dark document and metadata with light', () => {
  const doc = document.implementation.createHTMLDocument();
  doc.documentElement.dataset.theme = 'dark';
  doc.documentElement.style.colorScheme = 'dark';
  const meta = doc.createElement('meta');
  meta.name = 'color-scheme'; meta.content = 'light dark'; doc.head.append(meta);
  applyAppearance(doc);
  expect(doc.documentElement.dataset.theme).toBe('light');
  expect(doc.documentElement.style.colorScheme).toBe('light');
  expect(meta.content).toBe('light');
});
