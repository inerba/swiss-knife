import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { collectColors, IFRAME_COLOR_WARNING, scanPageColors } from './picker';

beforeEach(() => {
  document.head.innerHTML = '';
  document.body.innerHTML = '';
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 120, 40));
});
afterEach(() => vi.restoreAllMocks());

describe('collectColors', () => {
  it('collects background, icon and text colors from a card', async () => {
    document.body.innerHTML = `
      <article style="background-color:#f59e0b;color:#ffffff;opacity:1;padding:16px">
        <span style="display:block;width:40px;height:40px;background-color:#4d6d37;opacity:1;border-radius:50%"></span>
        <p style="color:#ffffff;opacity:1">€ 48.091.964</p>
      </article>`;
    const article = document.querySelector('article')!;
    expect(getComputedStyle(article).getPropertyValue('background-color')).toMatch(/245|f59e0b/i);
    const result = await collectColors(article, new AbortController().signal);
    const values = result.colors.map(item => item.value);
    expect(values).toEqual(expect.arrayContaining([
      expect.stringMatching(/245,\s*158,\s*11|#f59e0b/i),
      expect.stringMatching(/77,\s*109,\s*55|#4d6d37/i),
      expect.stringMatching(/255,\s*255,\s*255|#fff/i),
    ]));
    expect(result.colors.find(item => item.uses.includes('sfondo'))).toBeTruthy();
    expect(result.colors.find(item => item.uses.includes('testo'))).toBeTruthy();
  });
});

describe('scanPageColors', () => {
  it('collects colors from the whole document', async () => {
    document.body.innerHTML = `
      <article style="background-color:#f59e0b;color:#ffffff;opacity:1;padding:16px">
        <span style="display:block;width:40px;height:40px;background-color:#4d6d37;opacity:1;border-radius:50%"></span>
        <p style="color:#ffffff;opacity:1">€ 48.091.964</p>
      </article>`;
    const result = await scanPageColors(new AbortController().signal);
    const values = result.colors.map(item => item.value);
    expect(values).toEqual(expect.arrayContaining([
      expect.stringMatching(/245,\s*158,\s*11|#f59e0b/i),
      expect.stringMatching(/77,\s*109,\s*55|#4d6d37/i),
      expect.stringMatching(/255,\s*255,\s*255|#fff/i),
    ]));
  });

  it('warns when the page contains iframe or frame elements', async () => {
    document.body.innerHTML = '<iframe src="https://example.test/embed"></iframe>';
    const result = await scanPageColors(new AbortController().signal);
    expect(result.warnings).toContain(IFRAME_COLOR_WARNING);
  });
});
