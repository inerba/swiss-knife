import { beforeEach, expect, it, vi } from 'vitest';
import { buildContextPayload, scanEnvironment } from './collect';

beforeEach(() => {
  document.head.innerHTML = '<style>.card { padding: 24px } body { color: red }</style>';
  document.body.innerHTML = '<main id="app"><div class="card" data-swiss-inspect-x="1">Hi</div></main>';
  Element.prototype.scrollIntoView = vi.fn();
});

it('builds a serialisable payload for the element', () => {
  const element = document.querySelector('.card')!;
  const payload = buildContextPayload(element, window);
  expect(element.scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', inline: 'nearest' });
  expect(payload.element).toBe('div.card');
  expect(payload.path).toBe('main#app > div.card');
  expect(payload.url).toBe('https://example.test/path/');
  expect(payload.markup).toBe('<div class="card">Hi</div>');
  expect(payload.css.matched).toContain('/* <style> */\n.card { padding: 24px; }');
  expect(payload.css.inherited).toContain('/* <style> */\nbody { color: red; }');
  expect(payload.unreadableSheets).toEqual([]);
  expect(payload.viewport).toEqual({ width: window.innerWidth, height: window.innerHeight, devicePixelRatio: 1 });
  expect(JSON.parse(JSON.stringify(payload))).toEqual(payload);
});

it('treats missing media and supports APIs as non-matching', () => {
  const env = scanEnvironment({} as Window);
  expect(env.matchesMedia('(min-width: 1px)')).toBe(false);
  expect(env.supports('(display: grid)')).toBe(false);
});
