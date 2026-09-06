import { afterEach, expect, it, vi } from 'vitest';
import { assertCanvasSize, chooseRectangle, fullPageOutputScale, outerWidthForViewport, preparePageCapture, restorePageCapture, screenshotFilename, screenshotScale, setAffixedHidden } from './capture';

afterEach(() => {
  document.querySelectorAll('[data-swiss-screenshot-capture], [data-swiss-screenshot-select]').forEach(node => node.remove());
  delete document.documentElement.dataset.swissScreenshotFreeze;
  delete (window as Window & { __swissScreenshotSessions?: unknown }).__swissScreenshotSessions;
  Reflect.deleteProperty(document, 'getAnimations');
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('uses a portable PNG filename for every capture mode', () => {
  const filename = screenshotFilename('selezione');
  expect(filename).toMatch(/^screenshot-selezione-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.png$/);
  expect(filename.replace(/\.png$/, '')).not.toMatch(/[:.]/);
  expect(screenshotFilename('pagina', 'image/jpeg')).toMatch(/\.jpg$/);
  expect(screenshotFilename('schermata', 'image/webp')).toMatch(/\.webp$/);
});

it('stops complete-page captures that exceed canvas limits', () => {
  expect(() => assertCanvasSize(16_385, 100)).toThrow('troppo grande');
  expect(() => assertCanvasSize(10_000, 10_001)).toThrow('troppo grande');
  expect(() => assertCanvasSize(1_000, 1_000)).not.toThrow();
});

it('derives crop scale from the page viewport, never the side panel viewport', () => {
  expect(screenshotScale(2_880, 1_440)).toBe(2);
  expect(() => screenshotScale(1_000, 0)).toThrow('Dimensioni non valide');
});

it('converts a requested page viewport into the required Chrome outer width', () => {
  expect(outerWidthForViewport(1_500, 1_100, 400)).toBe(800);
  expect(outerWidthForViewport(700, 400, 320)).toBe(620);
});

it('makes an explicit viewport width independent from display pixel density', () => {
  expect(fullPageOutputScale(2, 400, 400)).toBe(1);
  expect(fullPageOutputScale(2, 1080, 1080)).toBe(1);
  expect(fullPageOutputScale(2, null, 1080)).toBe(2);
});

it('freezes motion and hides affixed elements only after the first page tile', () => {
  const fixed = document.createElement('div'); fixed.style.position = 'fixed'; document.body.append(fixed);
  const animation = { playState: 'running', pause: vi.fn(), play: vi.fn() };
  animation.pause.mockImplementation(() => { animation.playState = 'paused'; });
  Object.defineProperty(document, 'getAnimations', { configurable: true, value: vi.fn(() => [animation as unknown as Animation]) });
  preparePageCapture('capture-test');
  expect(document.documentElement.dataset.swissScreenshotFreeze).toBe('capture-test');
  expect(animation.pause).toHaveBeenCalledOnce();
  setAffixedHidden('capture-test', true);
  expect(fixed.style.getPropertyValue('visibility')).toBe('hidden');
  restorePageCapture('capture-test');
  expect(fixed.style.getPropertyValue('visibility')).toBe('');
  expect(animation.play).toHaveBeenCalledOnce();
  fixed.remove();
});

it('mounts a top-layer selection surface and removes it with Escape', async () => {
  const pending = chooseRectangle();
  const surface = document.querySelector('[data-swiss-screenshot-select]');
  expect(surface).not.toBeNull();
  const popover = document.querySelector('[popover="manual"]');
  expect(popover).not.toBeNull();
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await expect(pending).resolves.toBeNull();
  expect(document.querySelector('[popover="manual"]')).toBeNull();
});
