import { expect, it, vi } from 'vitest';
vi.mock('wxt/browser', () => ({ browser: {} }));
import { explainError } from './browser';

it('does not mislabel a missing grant on Tailwind as a protected page', () => {
  const message = explainError(new Error('Cannot access contents of url "https://tailwindcss.com/plus/kits/oatmeal/preview?theme=olive_instrument". Extension manifest must request permission to access this host.'));
  expect(message).toContain('Clicca l’icona Swiss Knife');
  expect(message).not.toContain('protetta');
});
it('distinguishes Chrome protected pages from missing grants', () => {
  expect(explainError(new Error('Cannot access a chrome:// URL'))).toContain('protetta');
  expect(explainError(new Error('The extensions gallery cannot be scripted.'))).toContain('protetta');
});
