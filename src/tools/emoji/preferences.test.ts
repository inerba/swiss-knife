import { describe, expect, it } from 'vitest';
import { defaultEmojiPreferences, emojiPreviewSizes, normalizeEmojiPreferences } from './preferences';

describe('emoji preferences', () => {
  it('uses the current preview size when storage is absent or invalid', () => {
    expect(normalizeEmojiPreferences(undefined)).toEqual(defaultEmojiPreferences);
    expect(normalizeEmojiPreferences({ previewSize: 24 })).toEqual(defaultEmojiPreferences);
  });

  it('preserves each supported preview size', () => {
    expect(emojiPreviewSizes).toEqual([22, 32, 42, 52, 60]);
    expect(normalizeEmojiPreferences({ previewSize: 60 })).toEqual({ previewSize: 60 });
  });
});
