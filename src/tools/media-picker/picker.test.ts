import { afterEach, expect, it, vi } from 'vitest';
import { installPicker } from './picker';
const collect = vi.hoisted(() => vi.fn());
vi.mock('./scan', () => ({ collectMedia: collect }));
afterEach(() => { document.body.innerHTML = ''; vi.restoreAllMocks(); });
it('blocks page pointer and click handlers while selecting, then restores them', async () => {
  document.body.innerHTML = '<a href="#clicked"><img src="photo.png"></a>';
  const pageClick = vi.fn(); const pageDown = vi.fn();
  const link = document.querySelector('a')!;
  link.addEventListener('click', pageClick); link.addEventListener('pointerdown', pageDown);
  collect.mockResolvedValue({ images: [], warnings: [], owners: new Map(), pageUrl: document.URL });
  const selected = vi.fn(); const dispose = installPicker(selected, vi.fn(), vi.fn());
  link.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, cancelable: true }));
  const click = new MouseEvent('click', { bubbles: true, cancelable: true, clientX: 30, clientY: 30 });
  link.dispatchEvent(click); await Promise.resolve(); await Promise.resolve();
  expect(click.defaultPrevented).toBe(true); expect(pageClick).not.toHaveBeenCalled(); expect(pageDown).not.toHaveBeenCalled(); expect(selected).toHaveBeenCalled();
  expect(document.querySelector('[data-swiss-picker]')).toBeNull();
  link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); expect(pageClick).toHaveBeenCalledTimes(1);
  dispose();
});
it('Esc removes overlays and cancels a pending scan', () => {
  collect.mockImplementation(() => new Promise(() => {}));
  const cancelled = vi.fn(); const dispose = installPicker(vi.fn(), cancelled, vi.fn());
  document.body.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  expect(cancelled).toHaveBeenCalledTimes(1); expect(document.querySelector('[data-swiss-picker]')).toBeNull();
  expect(collect.mock.calls.at(-1)![3].aborted).toBe(true); dispose();
});
