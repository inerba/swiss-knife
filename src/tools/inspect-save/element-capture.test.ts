import { describe, expect, it, vi } from 'vitest';
import { browser } from 'wxt/browser';
import { cropScreenshot, readPageSize } from '../screenshots/capture';
import { captureElementPng, elementFitsViewport } from './element-capture';

vi.mock('wxt/browser', () => ({
  browser: { scripting: { executeScript: vi.fn() }, tabs: { captureVisibleTab: vi.fn() } },
}));
vi.mock('../screenshots/capture', async importOriginal => ({
  ...await importOriginal<typeof import('../screenshots/capture')>(),
  cropScreenshot: vi.fn(async () => 'data:image/png;base64,cropped'),
}));

describe('elementFitsViewport', () => {
  it('returns true when the element fits entirely in the viewport', () => {
    expect(elementFitsViewport({
      left: 100,
      top: 80,
      width: 200,
      height: 120,
      viewportWidth: 1280,
      viewportHeight: 800,
      scrollX: 50,
      scrollY: 20,
    })).toBe(true);
  });

  it('returns false when the element extends beyond the viewport', () => {
    expect(elementFitsViewport({
      left: 100,
      top: 80,
      width: 200,
      height: 900,
      viewportWidth: 1280,
      viewportHeight: 800,
      scrollX: 0,
      scrollY: 0,
    })).toBe(false);
  });
});

describe('captureElementPng', () => {
  it('crops at the scroll position the page actually reached', async () => {
    vi.mocked(browser.scripting.executeScript).mockImplementation(async (options: { func?: unknown }) => {
      if (options.func === readPageSize) {
        return [{ result: { width: 1280, height: 800, viewportWidth: 1280, viewportHeight: 800, scrollX: 0, scrollY: 0, devicePixelRatio: 1 } }] as never;
      }
      // The page cannot scroll: moveTo stays at the origin.
      return [{ result: { x: 0, y: 0 } }] as never;
    });
    vi.mocked(browser.tabs.captureVisibleTab).mockResolvedValue('data:image/png;base64,shot' as never);

    const rect = { left: 456, top: 200, width: 368, height: 150, viewportWidth: 1280, viewportHeight: 800, scrollX: 0, scrollY: 0 };
    const result = await captureElementPng(1, 10, rect);

    expect(cropScreenshot).toHaveBeenCalledWith('data:image/png;base64,shot', {
      left: 456,
      top: 200,
      width: 368,
      height: 150,
      viewportWidth: 1280,
    }, 'image/png');
    expect(result).toEqual({ png: 'data:image/png;base64,cropped', clipped: false });
  });
});
