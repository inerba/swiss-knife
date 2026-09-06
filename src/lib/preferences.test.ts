import { expect, it } from 'vitest';
import { normalizeToolPreferences } from './preferences';

const ids = ['iframes', 'media-picker'];
it('uses registry order and enables every tool by default', () => {
  expect(normalizeToolPreferences(undefined, ids)).toEqual({ orderedIds: ids, disabledIds: [] });
});
it('removes stale and duplicate ids while adding new tools to the end', () => {
  expect(normalizeToolPreferences({ orderedIds: ['media-picker', 'missing', 'media-picker'], disabledIds: ['missing', 'iframes', 'iframes'] }, ids)).toEqual({ orderedIds: ['media-picker', 'iframes'], disabledIds: ['iframes'] });
});
