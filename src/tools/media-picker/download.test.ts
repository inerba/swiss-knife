import { expect, it } from 'vitest';
import { bulkDownloadPath, bulkDownloadSummary, downloadUrl } from './download';

it('prefers the recovered file and refuses a page blob that was never retrieved', () => {
  expect(downloadUrl({ url: 'https://cdn.test/a.png', details: { objectUrl: 'blob:ext/1' } })).toBe('blob:ext/1');
  expect(downloadUrl({ url: 'https://cdn.test/a.png', details: {} })).toBe('https://cdn.test/a.png');
  expect(downloadUrl({ url: 'blob:https://page.test/1', details: {} })).toBeUndefined();
});

it('groups bulk downloads under a sanitized page folder without asking for a destination', () => {
  expect(bulkDownloadPath('hero.png', 'https://www.shop.test/it/p/1')).toBe('cattura-media/www.shop.test/hero.png');
  expect(bulkDownloadPath('a.png', 'not-a-url')).toBe('cattura-media/pagina/a.png');
});

it('summarizes started, failed and skipped downloads without treating a partial batch as complete', () => {
  expect(bulkDownloadSummary(1, 0, 0)).toBe('1 download avviato.');
  expect(bulkDownloadSummary(3, 0, 0)).toBe('3 download avviati.');
  expect(bulkDownloadSummary(2, 1, 1)).toBe('2 download avviati. 1 non riuscito. 1 non scaricabile.');
  expect(bulkDownloadSummary(0, 0, 2)).toBe('2 file non sono scaricabili.');
});
